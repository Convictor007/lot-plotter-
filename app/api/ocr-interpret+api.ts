import { ExpoRequest } from 'expo-router/server';

import {
  detectImageMimeType,
  geminiVisionSurveyJson,
  getGeminiApiKey,
  getGeminiModel,
} from '@/lib/gemini-survey';
import { extractJsonObjectFromLlmText, getOllamaBaseUrl, getOllamaModel, ollamaVisionSurveyJson } from '@/lib/ollama-interpret';
import { normalizeOllamaLotsPayload } from '@/lib/ocr-survey-parse';

function parseModelJson(rawLlm: string): { parsed: unknown; error: string | null } {
  try {
    return { parsed: JSON.parse(extractJsonObjectFromLlmText(rawLlm)), error: null };
  } catch {
    return { parsed: null, error: 'Model did not return valid JSON. Try another photo.' };
  }
}

export async function POST(req: ExpoRequest) {
  try {
    const formData = await req.formData();
    const imageFile = (formData as any).get?.('image') as unknown;

    if (!imageFile || typeof (imageFile as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
      return Response.json({ success: false, message: 'No image uploaded' }, { status: 400 });
    }

    const arrayBuffer = await (imageFile as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const imageBase64 = buffer.toString('base64');
    const mimeType = detectImageMimeType(buffer);

    let rawLlm = '';
    let source: 'gemini' | 'ollama' = 'ollama';
    let modelLabel = '';

    if (getGeminiApiKey()) {
      try {
        rawLlm = await geminiVisionSurveyJson(imageBase64, mimeType);
        source = 'gemini';
        modelLabel = getGeminiModel();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Gemini request failed';
        return Response.json(
          {
            success: false,
            message: msg,
            hint: 'Check GEMINI_API_KEY and GEMINI_MODEL in .env (AI Studio: https://aistudio.google.com/apikey )',
          },
          { status: 502 }
        );
      }
    } else {
      try {
        rawLlm = await ollamaVisionSurveyJson(imageBase64);
        source = 'ollama';
        modelLabel = getOllamaModel();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Ollama request failed';
        return Response.json(
          {
            success: false,
            message: `${msg}. Or set GEMINI_API_KEY for Google Gemini (no local install).`,
            ollamaHost: getOllamaBaseUrl(),
            ollamaModel: getOllamaModel(),
          },
          { status: 503 }
        );
      }
    }

    const { parsed, error: parseErr } = parseModelJson(rawLlm);
    if (parseErr || parsed === null) {
      return Response.json(
        {
          success: false,
          message: parseErr || 'Invalid JSON',
          rawLlm: rawLlm.slice(0, 4000),
        },
        { status: 422 }
      );
    }

    const { tiePointReference, lots: parsedLots } = normalizeOllamaLotsPayload(parsed);
    const lots = parsedLots.filter((l) => l.corners.length > 0);

    if (lots.length === 0) {
      return Response.json({
        success: false,
        message:
          'No valid survey lines after validation (0–90°, 0–59′, distance > 0). Try a clearer image or CSV upload.',
        rawLlm: rawLlm.slice(0, 4000),
        source,
      });
    }

    const data = lots[0].corners;

    return Response.json({
      success: true,
      data,
      lots: lots.map((l) => ({
        lotNo: l.lotNo,
        claimant: l.claimant,
        corners: l.corners.map((c) => ({
          ns: c.ns,
          deg: c.deg,
          min: c.min,
          ew: c.ew,
          distance: c.distance,
          sheetLineLabel: c.sheetLineLabel,
        })),
      })),
      tiePointReference,
      source,
      model: modelLabel,
      warnings: [
        lots.length > 1
          ? `Multiple lots extracted (${lots.length}). Each lot's line 1 is monument → corner 1 for that parcel. Switch lots in review before OK.`
          : 'Line 1 should be from the document tie monument to corner 1; verify tiePointReference and all distances.',
        'Review all values against the document before plotting. Vision models can still make mistakes.',
      ],
    });
  } catch (error: unknown) {
    console.error('ocr-interpret:', error);
    const message = error instanceof Error ? error.message : 'Failed to interpret image';
    return Response.json({ success: false, message }, { status: 500 });
  }
}
