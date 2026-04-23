import * as fs from 'fs';
import * as path from 'path';

/** Uploaded government IDs (API writes here; DB stores basename only). */
export const VERIFY_IDS_DIR = path.join(process.cwd(), 'assets', 'id');

/** Basename only; blocks path traversal and unexpected shapes. */
export function isSafeIdDocumentFileName(name: string): boolean {
  if (!name || name.length > 500) return false;
  if (name !== path.basename(name)) return false;
  if (!/^id_[a-zA-Z0-9._@-]+$/.test(name)) return false;
  return true;
}

export function resolveIdDocumentPath(fileName: string): string | null {
  if (!isSafeIdDocumentFileName(fileName)) return null;
  const dir = path.resolve(VERIFY_IDS_DIR);
  const full = path.resolve(dir, fileName);
  if (!full.startsWith(dir + path.sep)) return null;
  return full;
}

export function tryUnlinkIdDocument(fileName: string | null | undefined): void {
  if (!fileName || !isSafeIdDocumentFileName(fileName)) return;
  const full = resolveIdDocumentPath(fileName);
  if (!full || !fs.existsSync(full)) return;
  try {
    fs.unlinkSync(full);
  } catch {
    //
  }
}
