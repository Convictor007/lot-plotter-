import { Platform } from 'react-native';

export interface ParsedCorner {
  ns: string;
  deg: string;
  min: string;
  sec?: string;
  ew: string;
  distance: string;
  /** Source column label from LOT DESCRIPTIONS (e.g. MON→C1, 1-2, 2-3). */
  sheetLineLabel?: string;
}

export type ScanReviewMeta = {
  extractionPath: 'ai' | 'tesseract';
  source?: 'gemini' | 'ollama';
  model?: string;
  warnings?: string[];
  /** Monument / BLLM / cadastral reference from the document (AI scan only). */
  tiePointReference?: string | null;
};

/** One parcel from a scan (single lot or one row of a multi-lot table). */
export type ScannedLot = {
  lotNo?: string | null;
  claimant?: string | null;
  corners: ParsedCorner[];
};

async function buildImageFormDataAsync(uri: string): Promise<FormData> {
  const formData = new FormData();

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    formData.append('image', blob, 'scanned_title.jpg');
  } else {
    formData.append('image', {
      uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
      name: 'scanned_title.jpg',
      type: 'image/jpeg',
    } as any);
  }

  return formData;
}

type InterpretScanOk = { ok: true; lots: ScannedLot[]; meta: ScanReviewMeta };
type InterpretScanFail = { ok: false; message?: string };

function normalizeLotsFromApiJson(json: Record<string, unknown>): ScannedLot[] | null {
  const rawLots = json.lots;
  if (Array.isArray(rawLots) && rawLots.length > 0) {
    const out: ScannedLot[] = [];
    for (const item of rawLots) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const corners = Array.isArray(row.corners) ? (row.corners as ParsedCorner[]) : [];
      const filtered = corners
        .filter(
          (c) => c && typeof c.ns === 'string' && typeof c.ew === 'string' && String(c.distance || '').length > 0
        )
        .map((c) => ({
          ...c,
          sheetLineLabel:
            typeof c.sheetLineLabel === 'string' && c.sheetLineLabel.trim()
              ? c.sheetLineLabel.trim()
              : undefined,
        }));
      if (filtered.length === 0) continue;
      const lotNo =
        row.lotNo === null || row.lotNo === undefined
          ? null
          : String(row.lotNo).trim() || null;
      const claimant =
        row.claimant === null || row.claimant === undefined
          ? null
          : String(row.claimant).trim() || null;
      out.push({ lotNo, claimant, corners: filtered });
    }
    return out.length > 0 ? out : null;
  }
  const data = json.data;
  if (Array.isArray(data) && data.length > 0) {
    return [{ corners: data as ParsedCorner[] }];
  }
  return null;
}

/** Gemini / Ollama vision via `/api/ocr-interpret` (server-side). */
async function fetchOllamaInterpret(uri: string, signal?: AbortSignal): Promise<ParsedCorner[] | null> {
  const full = await fetchInterpretScan(uri, signal);
  return full.ok && full.lots[0]?.corners?.length ? full.lots[0].corners : null;
}

async function fetchInterpretScan(uri: string, signal?: AbortSignal): Promise<InterpretScanOk | InterpretScanFail> {
  try {
    const formData = await buildImageFormDataAsync(uri);
    const res = await fetch('/api/ocr-interpret', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
      signal,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      return { ok: false, message: 'Invalid response from AI scan service.' };
    }

    if (res.ok && json?.success) {
      const lots = normalizeLotsFromApiJson(json as Record<string, unknown>);
      if (lots && lots.length > 0) {
        const warnings = Array.isArray(json.warnings) ? (json.warnings as string[]) : undefined;
        const tiePointReference =
          typeof json.tiePointReference === 'string' && json.tiePointReference.trim()
            ? json.tiePointReference.trim()
            : json.tiePointReference === null
              ? null
              : undefined;
        return {
          ok: true,
          lots,
          meta: {
            extractionPath: 'ai',
            source: json.source as ScanReviewMeta['source'],
            model: typeof json.model === 'string' ? json.model : undefined,
            warnings,
            tiePointReference,
          },
        };
      }
    }

    const message = typeof json?.message === 'string' ? json.message : `AI scan failed (${res.status})`;
    return { ok: false, message };
  } catch (e) {
    console.warn('ocr-interpret unavailable:', e);
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}

async function fetchTesseractOcr(uri: string, signal?: AbortSignal): Promise<ParsedCorner[]> {
  const formData = await buildImageFormDataAsync(uri);
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
    signal,
  });

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    throw new Error('OCR service returned an invalid response');
  }

  if (!res.ok || !json?.success) {
    throw new Error(json?.message || 'OCR failed to find coordinates');
  }

  return json.data as ParsedCorner[];
}

/**
 * Prefer `/api/ocr-interpret` (Gemini or Ollama), then fall back to Tesseract `/api/ocr`.
 */
export const extractCornersFromImage = async (uri: string, signal?: AbortSignal): Promise<ParsedCorner[]> => {
  try {
    const fromOllama = await fetchOllamaInterpret(uri, signal);
    if (fromOllama && fromOllama.length > 0) {
      return fromOllama;
    }
    return await fetchTesseractOcr(uri, signal);
  } catch (error) {
    console.error('OCR API Error: ', error);
    throw error;
  }
};

const TESSERACT_REVIEW_WARNINGS = [
  'Classic OCR was used. Compare every bearing and distance to your document.',
];

/**
 * AI scan first (Gemini when `GEMINI_API_KEY` is set on the server), then Tesseract.
 * Use with a review modal before applying rows to the lot plotter.
 */
export async function scanLandTitleImage(
  uri: string,
  signal?: AbortSignal
): Promise<{ lots: ScannedLot[]; meta: ScanReviewMeta }> {
  const fromAi = await fetchInterpretScan(uri, signal);
  if (fromAi.ok) {
    return { lots: fromAi.lots, meta: fromAi.meta };
  }

  const corners = await fetchTesseractOcr(uri, signal);
  const warnings = [...TESSERACT_REVIEW_WARNINGS];
  if (fromAi.message) {
    warnings.unshift(`AI scan did not complete: ${fromAi.message}`);
  }
  return {
    lots: [{ corners }],
    meta: {
      extractionPath: 'tesseract',
      warnings,
    },
  };
}
