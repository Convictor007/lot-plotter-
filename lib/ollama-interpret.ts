/**
 * Call a local Ollama vision model to extract quadrant bearings from a survey image.
 * Requires Ollama running (default http://127.0.0.1:11434) with a vision model pulled, e.g.:
 *   ollama pull llava
 */

/** Shared with Gemini + Ollama interpret routes. */
export const SURVEY_SYSTEM_PROMPT = `You read land survey / technical description tables from photos (Excel screenshots, typed documents, or camera photos).`;

export const SURVEY_USER_PROMPT = `Look at the image. Extract every **boundary traverse line** as quadrant bearings: N/S, degrees (0-90), minutes (0-59), E/W, distance (meters, positive number).

Return **only** valid JSON (no markdown fences, no commentary), exactly this shape:
{"corners":[{"ns":"S","deg":53,"min":23,"ew":"W","distance":221.77}]}

Rules:
- "ns" must be exactly "N" or "S". "ew" must be exactly "E" or "W".
- "deg" and "min" are integers. "distance" is a number (decimals allowed).
- Read rows in order from the table (top to bottom or as printed). Skip header rows like NS,Deg,Min,EW,Distance.
- If the table is rotated or messy, still infer the numeric columns correctly.
- Omit any row you cannot read confidently; do not guess wildly.`;

/** Strip ```json ... ``` wrappers some models still emit. */
export function extractJsonObjectFromLlmText(text: string): string {
  const trimmed = text.trim();
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) return fence[1].trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

export function getOllamaBaseUrl(): string {
  const raw = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
  return raw.replace(/\/$/, '');
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || 'llava';
}

export async function ollamaVisionSurveyJson(
  imageBase64: string,
  ocrHint?: string
): Promise<string> {
  const base = getOllamaBaseUrl();
  const model = getOllamaModel();

  let userContent = SURVEY_USER_PROMPT;
  if (ocrHint?.trim()) {
    userContent += `\n\nOptional noisy OCR hint (may be wrong; prefer the image):\n${ocrHint.slice(0, 8000)}`;
  }

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: SURVEY_SYSTEM_PROMPT },
        {
          role: 'user',
          content: userContent,
          images: [imageBase64],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${errText || res.statusText}`);
  }

  const body = (await res.json()) as {
    message?: { content?: string };
    error?: string;
  };

  if (body.error) {
    throw new Error(`Ollama: ${body.error}`);
  }

  const content = body.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Ollama returned no message content');
  }

  return content;
}
