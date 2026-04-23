/**
 * Call a local Ollama vision model to extract quadrant bearings from a survey image.
 * Requires Ollama running (default http://127.0.0.1:11434) with a vision model pulled, e.g.:
 *   ollama pull llava
 */

/** Shared with Gemini + Ollama interpret routes. */
export const SURVEY_SYSTEM_PROMPT = `You read land survey / technical description tables from photos (Excel screenshots, typed documents, or camera photos).`;

export const SURVEY_USER_PROMPT = `Look at the **entire** image (title page, memorandum, technical description, or traverse table).

1) **Tie point (monument)**  
   Find the official reference the lot is tied from: e.g. BLLM, PRC, geodetic station, cadastral lot/corner, "Beginning at… from …".  
   Put a short literal phrase in **tiePointReference** (or **null** if none is readable).

2) **Bearings and distances — corners array**  
   Build **corners** in traverse order as quadrant bearings: N/S, degrees (0–90), minutes (0–59), E/W, distance in **meters** (positive number).

   **Critical order for narrative deeds (paragraph style):**
   - **First object in corners** = bearing and distance **from the tie monument to point 1 / first corner** (the "Beginning at… from [tie]… N/S … E/W … m." line).
   - Each following object = the next **"thence"** side along the boundary (point 1→2, 2→3, …) until the polygon is closed or the described lines end.
   - For a **tabular** layout (columns NS, Deg, Min, EW, Distance), list rows **top to bottom**; if the table starts at the tie line, that row is first.

Return **only** valid JSON (no markdown fences, no commentary), exactly this shape:
{"tiePointReference":"BLLM No. 9, Tacloban Cad.","corners":[{"ns":"N","deg":57,"min":48,"ew":"W","distance":537.04},{"ns":"S","deg":82,"min":20,"ew":"E","distance":11.69}]}

Rules:
- "tiePointReference" is a string or **null** (JSON null), max one short phrase from the document.
- "ns" must be exactly "N" or "S". "ew" must be exactly "E" or "W".
- "deg" and "min" are integers. "distance" is a number (decimals allowed).
- Skip header rows like NS,Deg,Min,EW,Distance when reading tables.
- Omit any traverse line you cannot read confidently; do not guess wildly.`;

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
