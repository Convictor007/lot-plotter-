function normalizeProvidedLabel(sourceLabel?: string | null): string | null {
  const raw = (sourceLabel || '').trim();
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, '');
  if (/^(mon(\.|ument)?(to)?corner1|mon→c1|mon->c1)$/i.test(compact)) return 'MON→C1';
  const m = compact.match(/^(?:line)?(\d{1,2})[-–](\d{1,2})$/i);
  if (!m) return null;
  return `${parseInt(m[1], 10)}-${parseInt(m[2], 10)}`;
}

/**
 * LOT DESCRIPTIONS–style labels:
 * - prefer provided source label from OCR/AI (keeps duplicated 1-2 entries)
 * - else fallback to row index (MON→C1, then 1-2, 2-3, ...).
 */
export function formatSurveyLegSheetLabel(line: number, sourceLabel?: string | null): string {
  const provided = normalizeProvidedLabel(sourceLabel);
  if (provided) return provided;
  const raw = (sourceLabel || '').trim();
  // Keep custom survey labels (e.g. "Curve 1", "1-2A", "Seg 3") when provided by user/OCR.
  if (raw) return raw;
  if (!Number.isFinite(line) || line < 1) return '—';
  if (line <= 1) return 'MON→C1';
  const a = line - 1;
  return `${a}-${line}`;
}
