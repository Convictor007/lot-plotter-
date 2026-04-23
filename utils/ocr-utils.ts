import { Platform } from 'react-native';

export interface ParsedCorner {
  ns: string;
  deg: string;
  min: string;
  ew: string;
  distance: string;
}

export type ScanReviewMeta = {
  extractionPath: 'ai' | 'tesseract';
  source?: 'gemini' | 'ollama';
  model?: string;
  warnings?: string[];
  /** Monument / BLLM / cadastral reference from the document (AI scan only). */
  tiePointReference?: string | null;
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

type InterpretScanOk = { ok: true; corners: ParsedCorner[]; meta: ScanReviewMeta };
type InterpretScanFail = { ok: false; message?: string };

/** Gemini / Ollama vision via `/api/ocr-interpret` (server-side). */
async function fetchOllamaInterpret(uri: string): Promise<ParsedCorner[] | null> {
  const full = await fetchInterpretScan(uri);
  return full.ok ? full.corners : null;
}

async function fetchInterpretScan(uri: string): Promise<InterpretScanOk | InterpretScanFail> {
  try {
    const formData = await buildImageFormDataAsync(uri);
    const res = await fetch('/api/ocr-interpret', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      return { ok: false, message: 'Invalid response from AI scan service.' };
    }

    if (res.ok && json?.success && Array.isArray(json.data) && json.data.length > 0) {
      const warnings = Array.isArray(json.warnings) ? (json.warnings as string[]) : undefined;
      const tiePointReference =
        typeof json.tiePointReference === 'string' && json.tiePointReference.trim()
          ? json.tiePointReference.trim()
          : json.tiePointReference === null
            ? null
            : undefined;
      return {
        ok: true,
        corners: json.data as ParsedCorner[],
        meta: {
          extractionPath: 'ai',
          source: json.source as ScanReviewMeta['source'],
          model: typeof json.model === 'string' ? json.model : undefined,
          warnings,
          tiePointReference,
        },
      };
    }

    const message = typeof json?.message === 'string' ? json.message : `AI scan failed (${res.status})`;
    return { ok: false, message };
  } catch (e) {
    console.warn('ocr-interpret unavailable:', e);
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
}

async function fetchTesseractOcr(uri: string): Promise<ParsedCorner[]> {
  const formData = await buildImageFormDataAsync(uri);
  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
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
export const extractCornersFromImage = async (uri: string): Promise<ParsedCorner[]> => {
  try {
    const fromOllama = await fetchOllamaInterpret(uri);
    if (fromOllama && fromOllama.length > 0) {
      return fromOllama;
    }
    return await fetchTesseractOcr(uri);
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
export async function scanLandTitleImage(uri: string): Promise<{ corners: ParsedCorner[]; meta: ScanReviewMeta }> {
  const fromAi = await fetchInterpretScan(uri);
  if (fromAi.ok) {
    return { corners: fromAi.corners, meta: fromAi.meta };
  }

  const corners = await fetchTesseractOcr(uri);
  const warnings = [...TESSERACT_REVIEW_WARNINGS];
  if (fromAi.message) {
    warnings.unshift(`AI scan did not complete: ${fromAi.message}`);
  }
  return {
    corners,
    meta: {
      extractionPath: 'tesseract',
      warnings,
    },
  };
}
