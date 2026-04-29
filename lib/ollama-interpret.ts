/**
 * Call a local Ollama vision model to extract quadrant bearings from a survey image.
 * Requires Ollama running (default http://127.0.0.1:11434) with a vision model pulled, e.g.:
 *   ollama pull llava
 */

/** Shared with Gemini + Ollama interpret routes. */
export const SURVEY_SYSTEM_PROMPT = `You read land survey / technical description tables from photos (Excel screenshots, typed documents, or camera photos).`;

export const SURVEY_USER_PROMPT = `Look at the **entire** image (title page, memorandum, technical description, or traverse table).

1) **Tie point (monument)**  
   Find the official reference parcels are tied from: e.g. BLLM, PRC, geodetic station, cadastral monument (often **one** reference for a whole "LOT DESCRIPTIONS" / cadastral sheet).  
   Put a short literal phrase in **tiePointReference** (or **null** if none is readable).

2) **Single lot — corners array** (use when the image describes **one** parcel only)  
   Build **corners** in traverse order as quadrant bearings: N/S, degrees (0–90), minutes (0–59), E/W, distance in **meters** (positive number).  
   - **First object in corners** = **monument → corner 1** (same as "MON. TO CORNER 1", "Beginning at… from [monument]…").  
   - Each following object = the next boundary side (1→2, 2→3, …).

3) **Multiple lots — lots array** (when the image is a **table of many lots**, e.g. columns LOT NO., CLAIMANT, **MON. TO CORNER 1**, LINE 1-2, LINE 2-3, …)  
   Return **lots** as an array; **do not** merge different lots into one corners list.  
   For **each** lot row in the table:
   - **lotNo**: the lot number from the LOT NO. column (string).
   - **claimant**: short text from CLAIMANT if visible, else null.
   - **corners**: array for **that lot only**, in order:
     - **First** object = bearing & distance from **MON. TO CORNER 1** (monument to first corner of **this** lot). Values differ per lot even when the monument is the same.
     - Include **sheetLineLabel** on each object: use "MON->C1" for monument-to-corner line, then the sheet column label like "1-2", "2-3", ...
     - Then each **LINE 1-2, 2-3, …** segment in order. If a cell shows **two or more** bearings stacked vertically or on separate lines in the same column, that is still **one logical column** (e.g. LINE 1-2): those are **consecutive legs** along the boundary — output **one JSON corner object per leg**, in top-to-bottom reading order.
   Skip lots you cannot read; omit empty lots.

**Return shape (choose one):**  
- **One lot:** {"tiePointReference":"…","corners":[…]}  
- **Several lots:** {"tiePointReference":"…","lots":[{"lotNo":"487","claimant":"…","corners":[…]},{"lotNo":"490","claimant":null,"corners":[…]}]}

Rules:
- Never mix two lots into one **corners** array. Each lot always starts with its own monument→C1 line.
- "tiePointReference" is a string or **null** (JSON null), max one short phrase from the document.
- "ns" must be exactly "N" or "S". "ew" must be exactly "E" or "W".
- "deg" and "min" are integers. "distance" is a number (decimals allowed).
- "sheetLineLabel" is optional but preferred when readable: "MON->C1", "1-2", "2-3", ...
- Skip header rows. Omit lines you cannot read confidently; do not guess wildly.`;

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
