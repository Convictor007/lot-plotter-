import { Platform } from 'react-native';

export interface ParsedCorner {
  ns: string;
  deg: string;
  min: string;
  ew: string;
  distance: string;
}

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

/** Local Ollama vision (server must reach Ollama; phone uses Expo dev machine). */
async function fetchOllamaInterpret(uri: string): Promise<ParsedCorner[] | null> {
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
      return null;
    }

    if (res.ok && json?.success && Array.isArray(json.data) && json.data.length > 0) {
      return json.data as ParsedCorner[];
    }
  } catch (e) {
    console.warn('ocr-interpret unavailable:', e);
  }
  return null;
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
 * Prefer `/api/ocr-interpret` (Ollama vision on the dev machine), then fall back to Tesseract `/api/ocr`.
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
