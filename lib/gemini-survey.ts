/**
 * Google Gemini vision API for survey table extraction (no local model disk).
 * Free tier: Google AI Studio API key — https://aistudio.google.com/apikey
 *
 * Env: GEMINI_API_KEY (required), GEMINI_MODEL optional (default gemini-1.5-flash)
 */

import { SURVEY_SYSTEM_PROMPT, SURVEY_USER_PROMPT } from '@/lib/ollama-interpret';

export function getGeminiApiKey(): string | undefined {
  const k = process.env.GEMINI_API_KEY?.trim();
  return k || undefined;
}

export function getGeminiModel(): string {
  return (process.env.GEMINI_MODEL || 'gemini-1.5-flash').trim();
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

export async function geminiVisionSurveyJson(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const combinedPrompt = `${SURVEY_SYSTEM_PROMPT}\n\n${SURVEY_USER_PROMPT}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Gemini HTTP ${res.status}: ${raw.slice(0, 800)}`);
  }

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
