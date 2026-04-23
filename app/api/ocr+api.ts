import { createRequire } from 'module';
import { ExpoRequest } from 'expo-router/server';
import Tesseract from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';

import { parseSurveyCornersFromOcr } from '@/lib/ocr-survey-parse';

/**
 * Expo’s API bundle rewrites `__dirname` inside tesseract.js, so its default
 * worker path becomes `<cwd>/worker-script/node/index.js` (missing).
 * Point explicitly at the real file under node_modules.
 */
function getTesseractWorkerPath(): string {
  const projectRequire = createRequire(path.join(process.cwd(), 'package.json'));
  const pkgJson = projectRequire.resolve('tesseract.js/package.json');
  const root = path.dirname(pkgJson);
  return path.join(root, 'src', 'worker-script', 'node', 'index.js');
}

const TESSERACT_WORKER_PATH = getTesseractWorkerPath();

export async function POST(req: ExpoRequest) {
  try {
    const formData = await req.formData();
    const imageFile = (formData as any).get?.('image') as unknown;

    if (!imageFile || typeof (imageFile as { arrayBuffer?: unknown }).arrayBuffer !== 'function') {
      return Response.json(
        { success: false, message: 'No image uploaded' },
        { status: 400 }
      );
    }

    // Convert the uploaded File into a Buffer
    const arrayBuffer = await (imageFile as Blob).arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Temporary OCR files under project assets (not OS temp)
    const tempDir = path.join(process.cwd(), 'assets', 'temp', 'images');
    fs.mkdirSync(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, `ocr_scan_${Date.now()}.jpg`);

    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, buffer);

    let text = '';
    let pageData: Tesseract.Page | null = null;
    try {
      if (!fs.existsSync(TESSERACT_WORKER_PATH)) {
        throw new Error(
          `Tesseract worker not found at ${TESSERACT_WORKER_PATH}. Try reinstalling tesseract.js.`
        );
      }
      const worker = await Tesseract.createWorker('eng', Tesseract.OEM.LSTM_ONLY, {
        workerPath: TESSERACT_WORKER_PATH,
      });
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          user_defined_dpi: '300',
        });
        let result = await worker.recognize(tempFilePath);
        text = result.data.text;
        pageData = result.data;

        let parsed = parseSurveyCornersFromOcr(pageData);
        if (parsed.corners.length === 0) {
          await worker.setParameters({
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
            user_defined_dpi: '300',
          });
          result = await worker.recognize(tempFilePath);
          text = result.data.text;
          pageData = result.data;
        }
      } finally {
        await worker.terminate();
      }
    } finally {
      // Always delete the temporary file immediately after OCR finishes, even if it fails
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }

    if (!pageData) {
      return Response.json(
        { success: false, message: 'OCR produced no page data.', rawText: text },
        { status: 500 }
      );
    }

    const { corners, warnings } = parseSurveyCornersFromOcr(pageData);

    if (corners.length === 0) {
      return Response.json({
        success: false,
        message:
          'No valid survey lines found. Use good light, hold steady, fill the frame with the table, or upload a CSV. Each line needs: N/S, degrees (0–90), minutes (0–59), E/W, and distance > 0.',
        rawText: text,
        warnings,
      });
    }

    return Response.json({ success: true, data: corners, warnings });

  } catch (error: any) {
    console.error('OCR Error:', error);
    return Response.json(
      { success: false, message: error.message || 'Failed to process image' },
      { status: 500 }
    );
  }
}
