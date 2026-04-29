/**
 * Parse land-title / technical-description bearings from OCR output.
 * Uses Tesseract line layout when available, then validates DMS + distance.
 */

type TesseractPage = {
  text: string;
  blocks: Array<{
    paragraphs: Array<{
      lines: Array<{ text: string; confidence: number }>;
    }>;
  }> | null;
};

export type ParsedCornerRow = {
  line: number;
  ns: string;
  deg: string;
  min: string;
  ew: string;
  distance: string;
  sheetLineLabel?: string;
};

export type ParseSurveyResult = {
  corners: ParsedCornerRow[];
  warnings: string[];
};

/** Collect OCR lines in reading order; prefer structured layout over flat text. */
export function collectOcrLines(page: TesseractPage): string[] {
  const fromLayout: string[] = [];
  if (page.blocks) {
    for (const block of page.blocks) {
      for (const para of block.paragraphs || []) {
        for (const line of para.lines || []) {
          const t = (line.text || '').trim();
          if (!t) continue;
          /** Include low-confidence lines — strict filtering often leaves nothing on phone photos. */
          fromLayout.push(t);
        }
      }
    }
  }
  if (fromLayout.length > 0) {
    return fromLayout;
  }
  return page.text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalize common OCR noise before pattern matching.
 * Line breaks inside a table cell (stacked bearing/distance pairs) become spaces so
 * multiple legs in one column can be parsed in order.
 */
export function normalizeBearingLine(line: string): string {
  return line
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/\t+/g, ' ')
    .replace(/\u00b0/g, ' ')
    .replace(/[\u2018\u2019\u2032\u2033]/g, "'")
    .replace(/\bdeg\.?/gi, ' ')
    .replace(/\bmin\.?/gi, ' ')
    .replace(/\b(meters?|m\.?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** OCR often splits decimals: "221 77" after E/W → 221.77 (allow trailing junk). */
export function fixSplitDecimalDistance(line: string): string {
  return line.replace(
    /^(.+?\b[EW])\s+(\d{2,4})\s+(\d{2})\b/i,
    (_, prefix, a, b) => `${prefix} ${a}.${b}`
  );
}

/** Normalize distance token (handles 221,77 vs 221.77). */
export function normalizeDistanceToken(raw: string): string {
  let s = raw.replace(/[^\d,\.]/g, '').replace(/\.$/, '');
  if (!s) return '';
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    const parts = s.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      s = `${parts[0]}.${parts[1]}`;
    }
  }
  return s.replace(/\.$/, '');
}

function isValidBearing(deg: number, min: number, dist: number): boolean {
  return (
    Number.isFinite(deg) &&
    Number.isFinite(min) &&
    Number.isFinite(dist) &&
    deg >= 0 &&
    deg <= 90 &&
    min >= 0 &&
    min <= 59 &&
    dist > 0
  );
}

function normalizeQuadrantNS(raw: string): 'N' | 'S' | null {
  const u = raw.trim().toUpperCase();
  if (u === 'N' || u.startsWith('NORTH')) return 'N';
  if (u === 'S' || u.startsWith('SOUTH')) return 'S';
  return null;
}

function normalizeQuadrantEW(raw: string): 'E' | 'W' | null {
  const u = raw.trim().toUpperCase();
  if (u === 'E' || u.startsWith('EAST')) return 'E';
  if (u === 'W' || u.startsWith('WEST')) return 'W';
  return null;
}

function normalizeSheetLineLabel(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  const src = String(raw).trim();
  if (!src) return undefined;
  const compact = src.replace(/\s+/g, '');
  if (/^(mon(\.|ument)?(to)?corner1|mon→c1|mon->c1)$/i.test(compact)) return 'MON→C1';
  const m = compact.match(/^(?:line)?(\d{1,2})[-–](\d{1,2})$/i);
  if (!m) return undefined;
  return `${parseInt(m[1], 10)}-${parseInt(m[2], 10)}`;
}

/** Normalize LLM / JSON output into a validated corner row (or null). */
export function toValidatedCorner(
  ns: unknown,
  deg: unknown,
  min: unknown,
  ew: unknown,
  distance: unknown,
  line: number,
  sheetLineLabel?: unknown
): ParsedCornerRow | null {
  const nsU = normalizeQuadrantNS(String(ns ?? ''));
  const ewU = normalizeQuadrantEW(String(ew ?? ''));
  if (!nsU || !ewU) return null;

  const degN =
    typeof deg === 'number' && Number.isFinite(deg)
      ? Math.trunc(deg)
      : parseInt(String(deg ?? '').replace(/[^\d]/g, ''), 10);
  const minN =
    typeof min === 'number' && Number.isFinite(min)
      ? Math.trunc(min)
      : parseInt(String(min ?? '').replace(/[^\d]/g, ''), 10);

  const distanceStr = normalizeDistanceToken(String(distance ?? ''));
  const distN = parseFloat(distanceStr);

  if (!isValidBearing(degN, minN, distN)) return null;

  return {
    line,
    ns: nsU,
    deg: String(degN),
    min: String(minN),
    ew: ewU,
    distance: distanceStr,
    sheetLineLabel: normalizeSheetLineLabel(sheetLineLabel),
  };
}

/** Monument / BLLM / cadastral tie text from LLM JSON (optional). */
export function extractTiePointReferenceFromLlmPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const o = payload as Record<string, unknown>;
  const tryString = (v: unknown): string | null => {
    if (typeof v !== 'string') return null;
    const s = v.trim();
    if (!s || /^null$/i.test(s)) return null;
    return s.length > 500 ? s.slice(0, 500) : s;
  };

  const direct = tryString(o.tiePointReference) ?? tryString(o.tie_point_reference);
  if (direct) return direct;

  if (typeof o.tiePoint === 'string') {
    const s = tryString(o.tiePoint);
    if (s) return s;
  }

  if (o.tiePoint && typeof o.tiePoint === 'object') {
    const t = o.tiePoint as Record<string, unknown>;
    const nested =
      tryString(t.reference) ??
      tryString(t.monument) ??
      tryString(t.description) ??
      tryString(t.name) ??
      tryString(t.label);
    if (nested) return nested;
  }

  return tryString(o.monument) ?? tryString(o.tieFrom) ?? null;
}

/** Parse `{ corners: [...] }` from Ollama / LLM JSON; re-number lines 1..n. */
export function normalizeOllamaCornersPayload(payload: unknown): ParsedCornerRow[] {
  if (!payload || typeof payload !== 'object') return [];
  const corners = (payload as { corners?: unknown }).corners;
  if (!Array.isArray(corners)) return [];

  const out: ParsedCornerRow[] = [];
  let line = 1;
  for (const row of corners) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const v = toValidatedCorner(
      r.ns,
      r.deg,
      r.min,
      r.ew,
      r.distance,
      line++,
      r.sheetLineLabel ?? r.sheet_line_label ?? r.lineLabel ?? r.line_label ?? r.line
    );
    if (v) out.push(v);
  }
  return out.map((c, i) => ({ ...c, line: i + 1 }));
}

function tryLotField(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  if (!s || /^null$/i.test(s)) return null;
  return s.length > 120 ? s.slice(0, 120) : s;
}

export type NormalizedScannedLot = {
  lotNo: string | null;
  claimant: string | null;
  corners: ParsedCornerRow[];
};

/**
 * Prefer **lots**[] for multi-row "LOT DESCRIPTIONS" tables; else single **corners** at root.
 * Each lot's **corners[0]** = monument → corner 1 for that lot.
 */
export function normalizeOllamaLotsPayload(payload: unknown): {
  tiePointReference: string | null;
  lots: NormalizedScannedLot[];
} {
  const tiePointReference = extractTiePointReferenceFromLlmPayload(payload);
  if (!payload || typeof payload !== 'object') {
    return { tiePointReference, lots: [] };
  }
  const o = payload as Record<string, unknown>;
  const lotsRaw = o.lots;
  if (Array.isArray(lotsRaw) && lotsRaw.length > 0) {
    const lots: NormalizedScannedLot[] = [];
    for (const item of lotsRaw) {
      if (!item || typeof item !== 'object') continue;
      const L = item as Record<string, unknown>;
      const cornersArr = L.corners;
      if (!Array.isArray(cornersArr)) continue;
      const corners: ParsedCornerRow[] = [];
      let line = 1;
      for (const row of cornersArr) {
        if (!row || typeof row !== 'object') continue;
        const r = row as Record<string, unknown>;
        const v = toValidatedCorner(
          r.ns,
          r.deg,
          r.min,
          r.ew,
          r.distance,
          line++,
          r.sheetLineLabel ?? r.sheet_line_label ?? r.lineLabel ?? r.line_label ?? r.line
        );
        if (v) corners.push(v);
      }
      const fixedCorners = corners.map((c, i) => ({ ...c, line: i + 1 }));
      if (fixedCorners.length === 0) continue;
      const lotNo =
        tryLotField(L.lotNo) ??
        tryLotField(L.lot_no) ??
        tryLotField(L['LOT NO']) ??
        tryLotField(L['LOT NO.']);
      const claimant =
        tryLotField(L.claimant) ??
        tryLotField(L.CLAIMANT) ??
        tryLotField(L.claimantName) ??
        null;
      lots.push({ lotNo, claimant, corners: fixedCorners });
    }
    if (lots.length > 0) {
      return { tiePointReference, lots };
    }
  }

  const singleCorners = normalizeOllamaCornersPayload(payload);
  if (singleCorners.length === 0) {
    return { tiePointReference, lots: [] };
  }
  return {
    tiePointReference,
    lots: [{ lotNo: null, claimant: null, corners: singleCorners }],
  };
}

/** Patterns must match at the **current** start of the string (after trim) for multi-segment lines. */
const BEARING_AT_START_PATTERNS: RegExp[] = [
  /^([NS])[.\s,]+(\d{1,2})[.\s,]+(\d{1,2})[.\s,]+([EW])[.\s,]+([\d,\.]+)/i,
  /^([NS])\s*[,;]\s*(\d{1,2})\s*[,;]\s*(\d{1,2})\s*[,;]\s*([EW])\s*[,;]\s*([\d,\.]+)/i,
  /^[.\s,|/\\-]*([NS])[.\s,]+(\d{1,2})[.\s,°']+(\d{1,2})[.\s,°']+([EW])[.\s,]+([\d,\.]+)/i,
  /** Noisy OCR: allow junk between fields (bounded). */
  /^[.\s,|/\\-]*([NS])[^\dNS]{0,12}(\d{1,2})[^\d]{0,8}(\d{1,2})[^\d]{0,8}([EW])[^\d]{0,10}([\d,\.]+)/i,
];

type ParsedCornerFields = Omit<ParsedCornerRow, 'line'>;

/**
 * First valid quadrant bearing + distance at the start of an already-normalized string.
 * `matchLen` is always measured on `normalized` so callers can slice the same buffer safely.
 */
function tryParseFirstCornerAtNormalizedStart(normalized: string): { row: ParsedCornerFields; matchLen: number } | null {
  const fixed = fixSplitDecimalDistance(normalized);

  for (const re of BEARING_AT_START_PATTERNS) {
    const m = re.exec(fixed);
    if (!m || m.index !== 0) continue;
    const ns = m[1].toUpperCase();
    const ew = m[4].toUpperCase();
    const deg = parseInt(m[2], 10);
    const min = parseInt(m[3], 10);
    const distance = normalizeDistanceToken(m[5]);
    const dist = parseFloat(distance);
    if (!isValidBearing(deg, min, dist)) continue;
    return {
      row: {
        ns,
        deg: String(deg),
        min: String(min),
        ew,
        distance,
      },
      matchLen: m[0].length,
    };
  }
  return null;
}

/**
 * All bearing/distance legs read from one table cell: inline stacked pairs, newlines inside the cell,
 * or multiple quadrant patterns in sequence (real cadastral "LINE x-y" edge case).
 */
export function extractBearingSegmentsFromTableCell(raw: string): ParsedCornerFields[] {
  const out: ParsedCornerFields[] = [];
  let rest = fixSplitDecimalDistance(normalizeBearingLine(raw)).trim();
  for (let guard = 0; guard < 24 && rest.length; guard++) {
    const hit = tryParseFirstCornerAtNormalizedStart(rest);
    if (!hit) break;
    out.push(hit.row);
    rest = rest
      .slice(hit.matchLen)
      .replace(/^[\s,;|/\\.-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return out;
}

/**
 * When Tesseract splits one cell across two lines (e.g. "S56-45W" / "298.75"), joining yields more
 * valid legs than parsing separately. Does not merge when that would not increase segment count.
 */
function mergeSplitBearingOcrLines(lines: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    if (i < lines.length - 1) {
      const next = lines[i + 1];
      if (!isHeaderOrNoiseLine(cur) && !isHeaderOrNoiseLine(next)) {
        const sepA = extractBearingSegmentsFromTableCell(cur).length;
        const sepB = extractBearingSegmentsFromTableCell(next).length;
        const comb = extractBearingSegmentsFromTableCell(`${cur} ${next}`).length;
        if (comb > sepA + sepB) {
          out.push(`${cur} ${next}`.replace(/\s+/g, ' ').trim());
          i += 1;
          continue;
        }
      }
    }
    out.push(cur);
  }
  return out;
}

/** Table header / column titles (CSV, Excel export, etc.) */
function isHeaderOrNoiseLine(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true;
  if (/^line\b/i.test(s)) return true;
  if (/^(NS|N\/?S)\b/i.test(s) && /\bdeg\b/i.test(s) && /\bmin\b/i.test(s)) return true;
  if (/^NS[,.\s\t].*EW.*dist/i.test(s)) return true;
  if (/^[,.\s\t]*NS[,.\s\t]+Deg[,.\s\t]/i.test(s)) return true;
  if (/^deg\b/i.test(s) || /^min\b/i.test(s)) return true;
  if (/^distance\b/i.test(s)) return true;
  return false;
}

/**
 * When lines are merged or layout is empty, scan full OCR text left-to-right
 * for quadrant-bearing patterns and keep only validated rows (deduped).
 */
export function extractCornersFromFullOcrText(fullText: string): ParsedCornerRow[] {
  const normalized = normalizeBearingLine(fullText.replace(/\r/g, '\n')).replace(/\n+/g, ' ');
  const re =
    /([NS])[^\dNS]{0,14}?(\d{1,2})[^\d]{0,10}(\d{1,2})[^\d]{0,10}([EW])[^\d]{0,12}([\d,\.]+)/gi;
  const seen = new Set<string>();
  const out: ParsedCornerRow[] = [];
  let lineNo = 1;
  for (const m of normalized.matchAll(re)) {
    const ns = m[1].toUpperCase();
    const deg = parseInt(m[2], 10);
    const min = parseInt(m[3], 10);
    const ew = m[4].toUpperCase();
    const distance = normalizeDistanceToken(m[5]);
    const dist = parseFloat(distance);
    if (!isValidBearing(deg, min, dist)) continue;
    const key = `${ns}|${deg}|${min}|${ew}|${distance}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ line: lineNo++, ns, deg: String(deg), min: String(min), ew, distance });
  }
  return out;
}

export function parseSurveyCornersFromOcr(page: TesseractPage): ParseSurveyResult {
  const warnings: string[] = [];
  const rawLines = collectOcrLines(page).map(normalizeBearingLine).filter(Boolean);
  const lines = mergeSplitBearingOcrLines(rawLines);

  let corners: ParsedCornerRow[] = [];
  let lineNo = 1;
  let stackedCellCount = 0;

  for (const raw of lines) {
    if (isHeaderOrNoiseLine(raw)) continue;

    const segments = extractBearingSegmentsFromTableCell(raw);
    if (segments.length > 1) stackedCellCount += 1;
    for (const parsed of segments) {
      corners.push({ line: lineNo++, ...parsed });
    }
  }

  if (stackedCellCount > 0) {
    warnings.push(
      `Detected ${stackedCellCount} line(s) with multiple bearing/distance pairs (multi-line or stacked table cells); included all segments in traverse order. Verify against the document.`
    );
  }

  if (corners.length === 0 && page.text.trim()) {
    const fallback = extractCornersFromFullOcrText(page.text);
    if (fallback.length > 0) {
      corners = fallback;
      warnings.push(
        'Used full-text bearing scan (layout lines did not match). Verify values against your document.'
      );
    } else {
      warnings.push('No lines passed bearing validation (0–90°, 0–59′, distance > 0).');
    }
  }

  const distances = corners.map((c) => parseFloat(c.distance));
  const maxD = Math.max(...distances, 0);
  const minD = Math.min(...distances.filter((d) => d > 0), Infinity);
  if (corners.length >= 3 && maxD > 50 && minD < 5) {
    warnings.push(
      'Some distances are very small compared to others — check the photo focus and lighting.'
    );
  }

  return { corners, warnings };
}
