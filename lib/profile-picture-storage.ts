import * as fs from 'fs';
import * as path from 'path';

/** Profile photos (API writes here; DB stores basename only). */
export const PROFILE_PICTURES_DIR = path.join(process.cwd(), 'assets', 'profilepic');

/** Basename only: pp_{userId}_{timestamp}.{ext} */
export function isSafeProfilePictureFileName(name: string): boolean {
  if (!name || name.length > 500) return false;
  if (name !== path.basename(name)) return false;
  return /^pp_\d+_\d+\.(jpe?g|png|webp)$/i.test(name);
}

export function resolveProfilePicturePath(fileName: string): string | null {
  if (!isSafeProfilePictureFileName(fileName)) return null;
  const dir = path.resolve(PROFILE_PICTURES_DIR);
  const full = path.resolve(dir, fileName);
  if (!full.startsWith(dir + path.sep)) return null;
  return full;
}

export function tryUnlinkProfilePicture(fileName: string | null | undefined): void {
  if (!fileName || !isSafeProfilePictureFileName(fileName)) return;
  const full = resolveProfilePicturePath(fileName);
  if (!full || !fs.existsSync(full)) return;
  try {
    fs.unlinkSync(full);
  } catch {
    //
  }
}
