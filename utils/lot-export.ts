/**
 * Lot plotter export: CSV (traverse) + PDF summary with optional Google Static Map snapshot.
 */

import { Asset } from 'expo-asset';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  buildLotBasemapStaticUrl,
  buildLotMapOverlaySvg,
  computeStaticMapView,
} from '@/utils/lot-pdf-map';

const COMPASS_PNG = require('../assets/images/compass.png');

/** Load bundled compass art as a data URL so PDF/SVG `<image>` works offline in print. */
async function getCompassPngDataUri(): Promise<string | null> {
  try {
    const asset = Asset.fromModule(COMPASS_PNG);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) return null;

    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    }

    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

export type LotCornerRow = {
  line: number;
  ns: string;
  deg: string;
  min: string;
  ew: string;
  distance: string;
};

export type LotPolygonExport = {
  coordinates: [number, number][];
  area?: number;
  perimeter?: number;
  isValid?: boolean;
  closureError?: number;
};

export type LotTieContext = {
  name: string;
  province: string;
  municipality: string;
  lat: number;
  lon: number;
  zone: number;
  x: number;
  y: number;
} | null;

function getGoogleMapsApiKey(): string {
  const extra = Constants.expoConfig?.extra as { googleMapsApiKey?: string } | undefined;
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    extra?.googleMapsApiKey ||
    ''
  ).trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Remove dev URLs (e.g. from scans) so PDFs do not show localhost / 127.0.0.1. */
function stripDevOriginUrls(s: string): string {
  return s
    .replace(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[^\s)\]>'"]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** True when traverse can be exported (bearings + distances + closed polygon). */
export function isLotExportable(corners: LotCornerRow[], polygon: LotPolygonExport | null | undefined): boolean {
  if (!polygon?.coordinates || polygon.coordinates.length < 3) return false;
  if (corners.length < 3) return false;
  for (const c of corners) {
    if (!c.deg?.trim() || !c.min?.trim() || !c.distance?.trim()) return false;
    const dist = parseFloat(c.distance);
    if (!Number.isFinite(dist) || dist <= 0) return false;
    const deg = parseInt(c.deg, 10);
    const min = parseInt(c.min, 10);
    if (!Number.isFinite(deg) || deg < 0 || deg > 90) return false;
    if (!Number.isFinite(min) || min < 0 || min > 59) return false;
    if (c.ns !== 'N' && c.ns !== 'S') return false;
    if (c.ew !== 'E' && c.ew !== 'W') return false;
  }
  return true;
}

export function buildLotTraverseCsv(corners: LotCornerRow[]): string {
  const header = 'Line,NS,Deg,Min,EW,Distance_m';
  const rows = corners.map(
    (c) =>
      `${c.line},${c.ns},${c.deg},${c.min},${c.ew},${c.distance.replace(/,/g, '.')}`
  );
  return [header, ...rows].join('\r\n');
}

function formatBearing(ns: string, deg: string, min: string, ew: string): string {
  const d = deg.padStart(2, '0');
  const m = min.padStart(2, '0');
  return `${ns} ${d}° ${m}' ${ew}`;
}

/** Google Static Maps image URL (hybrid/roadmap + filled lot polygon). Returns null if no API key. */
export function buildLotStaticMapUrl(
  polygon: LotPolygonExport,
  opts?: {
    width?: number;
    height?: number;
    mapType?: 'hybrid' | 'satellite' | 'roadmap';
    tie?: LotTieContext | null;
  }
): string | null {
  const key = getGoogleMapsApiKey();
  if (!key) return null;

  const w = opts?.width ?? 640;
  const h = opts?.height ?? 400;
  const mapType = opts?.mapType ?? 'hybrid';
  const coords = polygon.coordinates;
  const pathPoints = coords.map(([lng, lat]) => `${lat.toFixed(6)},${lng.toFixed(6)}`).join('|');
  const pathParam = `color:0x1a237eff|weight:4|fillcolor:0x3b599880|${pathPoints}`;
  const visible = coords.map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join('|');

  let url = `https://maps.googleapis.com/maps/api/staticmap?size=${w}x${h}&scale=2&maptype=${mapType}&path=${encodeURIComponent(
    pathParam
  )}&visible=${encodeURIComponent(visible)}&key=${encodeURIComponent(key)}`;

  const tie = opts?.tie;
  if (tie && Number.isFinite(tie.lat) && Number.isFinite(tie.lon)) {
    const marker = `color:0xcc0000|size:mid|label:M|${tie.lat.toFixed(6)},${tie.lon.toFixed(6)}`;
    url += `&markers=${encodeURIComponent(marker)}`;
  }

  return url;
}

/**
 * On web, PDF is built via html2canvas → canvas.toDataURL. Remote http(s) images taint the canvas,
 * which throws SecurityError and forces the print fallback — Chrome then adds localhost/date in margins.
 * Native print can keep the URL (WebView loads it).
 */
function mapImageSrcForPdfAfterFetch(fetched: string | null, fallbackUrl: string): string | null {
  if (fetched) return fetched;
  return Platform.OS === 'web' ? null : fallbackUrl;
}

/** Download Static Map PNG and return a data URL so PDF renderers embed the plotted polygon reliably. */
async function fetchStaticMapAsDataUri(mapUrl: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(mapUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve, reject) => {
        const fr = new FileReader();
        fr.onloadend = () => resolve(typeof fr.result === 'string' ? fr.result : null);
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    }

    const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
    const file = `${base}lot-export-map-${Date.now()}.png`;
    const { uri } = await FileSystem.downloadAsync(mapUrl, file);
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}

function buildPdfHtml(
  corners: LotCornerRow[],
  polygon: LotPolygonExport,
  tie: LotTieContext,
  documentTieNote: string | null | undefined,
  mapImgSrc: string | null,
  mapHadApiKey: boolean,
  mapOverlaySvg: string | null
): string {
  const rowsHtml = corners
    .map(
      (c) => `<tr>
      <td>${c.line}</td>
      <td>${escapeHtml(c.ns)}</td>
      <td>${escapeHtml(c.deg)}</td>
      <td>${escapeHtml(c.min)}</td>
      <td>${escapeHtml(c.ew)}</td>
      <td>${escapeHtml(c.distance)}</td>
      <td>${escapeHtml(formatBearing(c.ns, c.deg, c.min, c.ew))}</td>
    </tr>`
    )
    .join('');

  const tieBlock = tie
    ? `<p><strong>Tie point</strong><br/>${escapeHtml(tie.name)}<br/>
       ${escapeHtml(tie.province)} · ${escapeHtml(tie.municipality)}<br/>
       Lat ${tie.lat.toFixed(6)}°, Lon ${tie.lon.toFixed(6)}°, Zone ${tie.zone}<br/>
       E ${tie.x}, N ${tie.y}</p>`
    : '<p><em>No tie point selected.</em></p>';

  const docTieNoteClean = documentTieNote?.trim() ? stripDevOriginUrls(documentTieNote.trim()) : '';
  const docTie =
    docTieNoteClean ?
      `<p><strong>Document tie (scan)</strong><br/>${escapeHtml(docTieNoteClean)}</p>`
    : '';

  const statParts: string[] = [];
  if (polygon.area != null) {
    statParts.push(`<span><strong>Area</strong> ${polygon.area.toFixed(2)} sqm</span>`);
  }
  if (polygon.perimeter != null) {
    statParts.push(`<span><strong>Perimeter</strong> ${polygon.perimeter.toFixed(2)} m</span>`);
  }
  if (polygon.closureError != null) {
    statParts.push(
      `<span><strong>Closure check</strong> ${polygon.isValid ? 'OK' : 'Review'} (error ${polygon.closureError.toFixed(3)} m)</span>`
    );
  }
  const statsRow =
    statParts.length > 0 ? `<div class="stats-row">${statParts.join('')}</div>` : '';

  const mapSection = (() => {
    if (!mapHadApiKey) {
      return `<p class="muted">GIS map skipped — set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (or app config extra.googleMapsApiKey) to embed the plotted lot on Google Maps.</p>`;
    }
    if (mapImgSrc) {
      const stack =
        mapOverlaySvg ?
          `<div class="map-stack">
            <img class="map-img" src="${escapeHtml(mapImgSrc)}" alt="Lot basemap" />
            <div class="map-svg-overlay">${mapOverlaySvg}</div>
          </div>`
        : `<div class="map-stack map-stack-img-only"><img class="map-img" src="${escapeHtml(mapImgSrc)}" alt="Lot polygon on map" /></div>`;
      return `<h2>Lot polygon — GIS map</h2>
       ${stack}`;
    }
    return `<h2>Lot polygon — GIS map</h2>
       <p class="muted">Could not download the map image. Check the API key, Static Maps API access, and network, then try again.</p>`;
  })();

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { margin: 12mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 16px; color: #222; font-size: 12px; }
  h2 { font-size: 14px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 6px 4px; text-align: center; }
  th { background: #f0f0f0; }
  .map-wrap { margin: 12px 0; text-align: center; }
  .map-stack { position: relative; display: block; width: 100%; max-width: 640px; margin: 12px auto; line-height: 0; }
  .map-stack .map-img { display: block; width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; }
  .map-stack .map-svg-overlay { position: absolute; left: 0; top: 0; width: 100%; height: 100%; pointer-events: none; }
  .map-stack .map-svg-overlay svg { position: absolute; left: 0; top: 0; width: 100%; height: 100%; }
  .map-stack-img-only { text-align: center; }
  .map-img { max-width: 100%; height: auto; border: 1px solid #ccc; border-radius: 4px; }
  .muted { color: #666; font-size: 10px; }
  .stats-row { display: flex; flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 20px 28px; margin: 14px 0 8px; font-size: 11px; }
  .stats-row span { white-space: nowrap; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
  ${tieBlock}
  ${docTie}
  ${mapSection}
  <h2>Traverse lines (bearings & distances)</h2>
  <table>
    <thead><tr><th>Line</th><th>NS</th><th>Deg</th><th>Min</th><th>EW</th><th>Dist (m)</th><th>Bearing</th></tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  ${statsRow}
</body></html>`;
}

export async function shareLotCsv(
  corners: LotCornerRow[],
  filename = `lot-traverse-${Date.now()}.csv`
): Promise<void> {
  const csv = buildLotTraverseCsv(corners);

  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return;
  }

  const base = FileSystem.cacheDirectory ?? FileSystem.documentDirectory ?? '';
  const path = `${base}${filename}`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(path, {
      mimeType: 'text/csv',
      dialogTitle: 'Share CSV',
      UTI: 'public.comma-separated-values-text',
    });
  } else {
    Alert.alert('Export', `CSV saved to:\n${path}`);
  }
}

const PDF_MAP_W = 640;
const PDF_MAP_H = 480;

/** Inline any remaining http(s) images so html2canvas output is not tainted (avoids SecurityError → print → localhost in margins). */
async function prepareReportDomForHtml2Canvas(root: HTMLElement): Promise<void> {
  const transparent =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const rasterImgs = Array.from(
    root.querySelectorAll('img[src^="http://"], img[src^="https://"]')
  ) as HTMLImageElement[];

  await Promise.all(
    rasterImgs.map(async (img) => {
      const src = img.getAttribute('src');
      if (!src) return;
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error('map fetch failed');
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () =>
            typeof fr.result === 'string' ? resolve(fr.result) : reject(new Error('read'));
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
        img.setAttribute('src', dataUrl);
      } catch {
        img.setAttribute('src', transparent);
      }
    })
  );

  const svgImages = root.querySelectorAll('svg image');
  await Promise.all(
    Array.from(svgImages).map(async (el) => {
      const raw =
        el.getAttribute('href') ||
        el.getAttribute('xlink:href') ||
        (typeof (el as SVGImageElement).href?.baseVal === 'string'
          ? (el as SVGImageElement).href.baseVal
          : '');
      if (!raw || !/^https?:\/\//i.test(raw)) return;
      try {
        const res = await fetch(raw);
        if (!res.ok) throw new Error('svg image fetch failed');
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () =>
            typeof fr.result === 'string' ? resolve(fr.result) : reject(new Error('read'));
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
        el.setAttribute('href', dataUrl);
        el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);
      } catch {
        el.setAttribute('href', transparent);
        try {
          el.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', transparent);
        } catch {
          //
        }
      }
    })
  );
}

async function whenImagesLoaded(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        img.complete && img.naturalHeight > 0 ?
          Promise.resolve()
        : new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
          })
    )
  );
}

 /**
 * Build a real PDF in the browser with html2canvas + jsPDF (no print dialog — Chrome print adds localhost/date in margins).
 * Uses an off-screen host in the main document; iframe srcdoc often breaks html2canvas or triggers the print fallback.
 */
async function downloadLotReportPdfOnWeb(html: string): Promise<void> {
  if (typeof document === 'undefined') {
    throw new Error('PDF export requires a browser document');
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const host = document.createElement('div');
  host.setAttribute('data-lot-pdf-render', '1');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:800px;max-width:800px;background:#ffffff;pointer-events:none;';

  parsed.head.querySelectorAll('style').forEach((s) => {
    host.appendChild(s);
  });
  while (parsed.body.firstChild) {
    host.appendChild(parsed.body.firstChild);
  }

  document.body.appendChild(host);

  try {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await new Promise<void>((r) => setTimeout(r, 50));

    await prepareReportDomForHtml2Canvas(host);
    await whenImagesLoaded(host);
    await new Promise<void>((r) => setTimeout(r, 100));

    const html2canvas = (await import('html2canvas')).default;
    // Metro resolves package root to jspdf.node.min.js (breaks on require(["html2canvas"])).
    const { jsPDF } = await import('jspdf/dist/jspdf.es.min.js');

    const canvas = await html2canvas(host, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      imageTimeout: 20000,
      windowWidth: host.scrollWidth,
      windowHeight: host.scrollHeight,
    });

    let imgData: string;
    try {
      imgData = canvas.toDataURL('image/png', 1.0);
    } catch (e) {
      throw new Error(
        e instanceof Error ?
          `Canvas export blocked (${e.message}). Try again or check map images.`
        : 'Canvas export blocked (cross-origin image).'
      );
    }

    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 10;
    const imgWidth = pageWidth - 2 * margin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 2 * margin;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 2 * margin;
    }

    pdf.save(`lot-plot-${Date.now()}.pdf`);
  } finally {
    host.remove();
  }
}

export async function shareLotPdf(
  corners: LotCornerRow[],
  polygon: LotPolygonExport,
  tie: LotTieContext,
  documentTieNote?: string | null
): Promise<void> {
  const mapHadApiKey = !!getGoogleMapsApiKey();
  const key = getGoogleMapsApiKey();
  let mapImgSrc: string | null = null;
  let mapOverlaySvg: string | null = null;

  if (mapHadApiKey && key) {
    const view = computeStaticMapView(polygon.coordinates, PDF_MAP_W, PDF_MAP_H, 50);
    if (view) {
      const basemapUrl = buildLotBasemapStaticUrl(view, 'hybrid', key);
      const compassHref = await getCompassPngDataUri();
      mapOverlaySvg = buildLotMapOverlaySvg(polygon, view, {
        strokeColor: '#3b5998',
        areaM2: polygon.area ?? null,
        tie: tie ? { lat: tie.lat, lon: tie.lon } : null,
        compassImageHref: compassHref,
      });
      mapImgSrc = mapImageSrcForPdfAfterFetch(await fetchStaticMapAsDataUri(basemapUrl), basemapUrl);
    } else {
      const fallbackUrl = buildLotStaticMapUrl(polygon, { tie, width: PDF_MAP_W, height: PDF_MAP_H });
      if (fallbackUrl) {
        mapOverlaySvg = null;
        mapImgSrc = mapImageSrcForPdfAfterFetch(await fetchStaticMapAsDataUri(fallbackUrl), fallbackUrl);
      }
    }
  }

  const html = buildPdfHtml(corners, polygon, tie, documentTieNote, mapImgSrc, mapHadApiKey, mapOverlaySvg);

  if (Platform.OS === 'web') {
    try {
      await downloadLotReportPdfOnWeb(html);
    } catch (err) {
      console.warn('lot-export: PDF download failed', err);
      const detail = err instanceof Error ? err.message : String(err);
      Alert.alert(
        'PDF export failed',
        `${detail}\n\nThe app does not open the browser print dialog automatically. Fix the issue above or use Print manually with “Headers and footers” disabled if you save as PDF.`
      );
    }
    return;
  }

  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Share PDF',
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('Export', `PDF saved to:\n${uri}`);
  }
}
