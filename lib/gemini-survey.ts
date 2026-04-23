/**
 * Google Gemini vision API for survey table extraction (no local model disk).
 * Free tier: Google AI Studio API key — https://aistudio.google.com/apikey
 *
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL optional (default gemini-2.5-flash).
 * Note: gemini-1.5-flash is retired for v1beta generateContent — use 2.x / ListModels.
 */

import { SURVEY_SYSTEM_PROMPT, SURVEY_USER_PROMPT } from '@/lib/ollama-interpret';

export function getGeminiApiKey(): string | undefined {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || undefined;
}

export function getGeminiModel(): string {
  const raw = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();
  return raw.replace(/^models\//, '');
}

export function detectImageMimeType(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (buffer.length >= 12 && buffer.slice(0, 4).toString('ascii') === 'RIFF') {
    return 'image/webp';
  }
  return 'image/jpeg';
}

/** If primary model 404s (retired name / region), try these in order. */
const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-flash-latest',
];

const GEMINI_RETRYABLE_STATUS = new Set([503, 429]);
/** Retries per model for overload / rate limit (Google often returns 503 "high demand"). */
const GEMINI_MAX_ATTEMPTS_PER_MODEL = Number(process.env.GEMINI_MAX_RETRIES || '4') || 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseGeminiSuccessBody(raw: string): string {
  let data: {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Gemini returned non-JSON body');
  }

  if (data.error?.message) {
    throw new Error(`Gemini: ${data.error.message}`);
  }
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked the request: ${data.promptFeedback.blockReason}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== 'string') {
    throw new Error('Gemini returned no candidate text');
  }

  return text;
}

export async function geminiVisionSurveyJson(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const preferred = getGeminiModel();
  const modelsToTry = [preferred, ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== preferred)];

  const combinedPrompt = `${SURVEY_SYSTEM_PROMPT}\n\n${SURVEY_USER_PROMPT}`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: combinedPrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  });

  let lastErrorSnippet = '';

  modelLoop: for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS_PER_MODEL; attempt++) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      const raw = await res.text();

      if (res.ok) {
        return parseGeminiSuccessBody(raw);
      }

      lastErrorSnippet = raw.slice(0, 800);

      if (res.status === 404) {
        continue modelLoop;
      }

      if (GEMINI_RETRYABLE_STATUS.has(res.status) && attempt < GEMINI_MAX_ATTEMPTS_PER_MODEL) {
        const base = 900 * 2 ** (attempt - 1);
        const jitter = Math.floor(Math.random() * 400);
        await sleep(base + jitter);
        continue;
      }

      if (GEMINI_RETRYABLE_STATUS.has(res.status)) {
        continue modelLoop;
      }

      throw new Error(`Gemini HTTP ${res.status}: ${lastErrorSnippet}`);
    }
  }

  throw new Error(
    `Gemini unavailable (overloaded or rate-limited after retries; tried ${modelsToTry.join(', ')}). ${lastErrorSnippet}`
  );
}
