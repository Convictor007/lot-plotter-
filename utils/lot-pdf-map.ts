/**
 * PDF lot map: Google Static basemap (center + zoom) + SVG overlay aligned to the same projection
 * (polygon, Line i–j labels, area card, compass) — matches in-app MapView styling.
 */

const TILE = 256;

/** Structural match for lot-export polygon / tie (avoid circular import). */
type PdfPolygon = { coordinates: [number, number][]; area?: number };
type PdfTie = { lat: number; lon: number } | null;

export type StaticMapView = {
  centerLat: number;
  centerLng: number;
  zoom: number;
  mapW: number;
  mapH: number;
};

type LatLngBounds = { sw: { lat: number; lng: number }; ne: { lat: number; lng: number } };

function boundsFromRing(coords: [number, number][]): LatLngBounds {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const [lng, lat] of coords) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return { sw: { lat: minLat, lng: minLng }, ne: { lat: maxLat, lng: maxLng } };
}

function latRad(lat: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
  return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
}

/** Integer zoom to fit bounds in a Static Map viewport (similar to fitBounds + padding). */
function zoomLevelForBounds(bounds: LatLngBounds, mapW: number, mapH: number, paddingPx: number): number {
  const ZOOM_MAX = 21;
  const WORLD_DIM = 256;
  const innerW = Math.max(1, mapW - 2 * paddingPx);
  const innerH = Math.max(1, mapH - 2 * paddingPx);
  const zoom = (mapPx: number, worldPx: number, fraction: number) => {
    const ratio = mapPx / worldPx / Math.max(fraction, 1e-10);
    if (ratio <= 0 || !Number.isFinite(ratio)) return NaN;
    return Math.log(ratio) / Math.LN2;
  };

  const latFraction = (latRad(bounds.ne.lat) - latRad(bounds.sw.lat)) / Math.PI;
  const lngDiff = bounds.ne.lng - bounds.sw.lng;
  const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

  const latZoom = zoom(innerH, WORLD_DIM, Math.max(latFraction, 1e-8));
  const lngZoom = zoom(innerW, WORLD_DIM, Math.max(lngFraction, 1e-8));
  const z = Math.min(latZoom, lngZoom);
  if (!Number.isFinite(z)) {
    return 16;
  }
  return Math.min(Math.max(Math.floor(z), 0), ZOOM_MAX);
}

export function computeStaticMapView(
  coords: [number, number][],
  mapW: number,
  mapH: number,
  paddingPx = 50
): StaticMapView | null {
  if (coords.length < 3) return null;
  const b = boundsFromRing(coords);
  const zoom = zoomLevelForBounds(b, mapW, mapH, paddingPx);
  const centerLat = (b.sw.lat + b.ne.lat) / 2;
  const centerLng = (b.sw.lng + b.ne.lng) / 2;
  return { centerLat, centerLng, zoom, mapW, mapH };
}

/** Web Mercator pixel at zoom (same model as Google Maps JS / Static Maps). */
function latLngToWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * scale;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function latLngToMapPixel(
  lat: number,
  lng: number,
  view: StaticMapView
): { x: number; y: number } {
  const p = latLngToWorldPixel(lat, lng, view.zoom);
  const c = latLngToWorldPixel(view.centerLat, view.centerLng, view.zoom);
  return {
    x: p.x - c.x + view.mapW / 2,
    y: p.y - c.y + view.mapH / 2,
  };
}

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ringCentroid(coords: [number, number][]): { lat: number; lng: number } {
  const n = coords.length - 1;
  if (n < 1) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  for (let i = 0; i < n; i++) {
    lng += coords[i][0];
    lat += coords[i][1];
  }
  return { lat: lat / n, lng: lng / n };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Hybrid basemap only (no path); lot geometry and compass are drawn in SVG overlay. */
export function buildLotBasemapStaticUrl(
  view: StaticMapView,
  mapType: 'hybrid' | 'satellite',
  apiKey: string
): string {
  const { centerLat, centerLng, zoom, mapW, mapH } = view;
  return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(
    `${centerLat.toFixed(6)},${centerLng.toFixed(6)}`
  )}&zoom=${zoom}&size=${mapW}x${mapH}&scale=2&maptype=${mapType}&key=${encodeURIComponent(apiKey)}`;
}

const DEFAULT_STROKE = '#3b5998';

export function buildLotMapOverlaySvg(
  polygon: PdfPolygon,
  view: StaticMapView,
  opts?: {
    strokeColor?: string;
    areaM2?: number | null;
    tie?: PdfTie;
    /** `data:image/png;base64,...` or https URL — embeds `assets/images/compass2.png` in PDF overlay */
    compassImageHref?: string | null;
  }
): string {
  const coords = polygon.coordinates;
  if (coords.length < 3) return '';

  const stroke = opts?.strokeColor || DEFAULT_STROKE;
  const { mapW, mapH } = view;

  const pts = coords.map(([lng, lat]) => latLngToMapPixel(lat, lng, view));
  const pointsAttr = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  const segments: string[] = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const [lng1, lat1] = coords[i];
    const [lng2, lat2] = coords[i + 1];
    const dist = haversineM(lat1, lng1, lat2, lng2);
    const nextCorner = i + 2 === coords.length ? 1 : i + 2;
    const label = `Line ${i + 1}-${nextCorner}: ${dist.toFixed(1)}m`;
    const midLat = (lat1 + lat2) / 2;
    const midLng = (lng1 + lng2) / 2;
    const mid = latLngToMapPixel(midLat, midLng, view);
    segments.push(
      `<text x="${mid.x.toFixed(2)}" y="${mid.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="11" font-weight="bold" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" stroke="#222222" stroke-width="0.35" paint-order="stroke">${escapeXml(
        label
      )}</text>`
    );
  }

  const centroid = ringCentroid(coords);
  const cpt = latLngToMapPixel(centroid.lat, centroid.lng, view);
  const areaVal =
    opts?.areaM2 != null && Number.isFinite(opts.areaM2) ? opts.areaM2 : polygon.area != null ? polygon.area : null;
  const areaLineLabel = areaVal != null ? `${areaVal.toFixed(3)} sqm` : '—';

  /** Same style as perimeter “Line i–j: …m” labels — no white popup box. */
  const areaOverlay = `<text x="${cpt.x.toFixed(2)}" y="${cpt.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="11" font-weight="bold" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" stroke="#222222" stroke-width="0.35" paint-order="stroke">${escapeXml(
    areaLineLabel
  )}</text>`;

  const compassSize = 136;
  const compassS = compassSize / 68;
  const compassX = mapW - compassSize - 14;
  const compassY = 12;
  const compassHref = opts?.compassImageHref?.trim();
  const compass =
    compassHref ?
      `<image xlink:href="${escapeXml(compassHref)}" href="${escapeXml(compassHref)}" x="${compassX}" y="${compassY}" width="${compassSize}" height="${compassSize}" preserveAspectRatio="xMidYMid meet"/>`
    : `<g transform="translate(${compassX + compassSize / 2},${compassY + compassSize / 2})">
    <circle r="${34 * compassS}" fill="rgba(255,255,255,0.94)" stroke="#333333" stroke-width="${1.2 * compassS}"/>
    <text x="0" y="${-20 * compassS}" text-anchor="middle" fill="#111" font-size="${13 * compassS}" font-weight="bold" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">N</text>
    <text x="${24 * compassS}" y="${5 * compassS}" text-anchor="middle" fill="#333" font-size="${11 * compassS}" font-weight="600" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">E</text>
    <text x="0" y="${28 * compassS}" text-anchor="middle" fill="#333" font-size="${11 * compassS}" font-weight="600" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">S</text>
    <text x="${-24 * compassS}" y="${5 * compassS}" text-anchor="middle" fill="#333" font-size="${11 * compassS}" font-weight="600" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif">W</text>
    <path d="M 0,${-16 * compassS} L ${-5 * compassS},${-2 * compassS} L ${-1 * compassS},${-2 * compassS} L ${-1 * compassS},${10 * compassS} L ${1 * compassS},${10 * compassS} L ${1 * compassS},${-2 * compassS} L ${5 * compassS},${-2 * compassS} Z" fill="#b91c1c" stroke="#7f1d1d" stroke-width="${0.5 * compassS}"/>
  </g>`;

  let tieG = '';
  const tie = opts?.tie;
  if (tie && Number.isFinite(tie.lat) && Number.isFinite(tie.lon)) {
    const tp = latLngToMapPixel(tie.lat, tie.lon, view);
    tieG = `<circle cx="${tp.x.toFixed(2)}" cy="${tp.y.toFixed(2)}" r="6" fill="#cc0000" stroke="#ffffff" stroke-width="2"/>
      <text x="${tp.x.toFixed(2)}" y="${(tp.y + 18).toFixed(2)}" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="bold" stroke="#000000" stroke-width="0.3" paint-order="stroke">M</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${mapW} ${mapH}" width="${mapW}" height="${mapH}" preserveAspectRatio="xMidYMid meet">
    <polygon points="${pointsAttr}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${segments.join('\n')}
    ${areaOverlay}
    ${compass}
    ${tieG}
  </svg>`;
}
