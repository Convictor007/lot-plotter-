/**
 * iAssess - Tie Points Service
 * Loads nationwide tie points from assets/tiepoints-2025.json
 * (Will switch to API later.)
 */

export interface TiePoint {
  id: string;
  name: string;
  province: string;
  municipality: string;
  lat: number;
  lon: number;
  zone: number;
  /** Easting (m), PRS92 / TM grid — from source field `X`. */
  x: number;
  /** Northing (m), PRS92 / TM grid — from source field `Y`. */
  y: number;
}

// JSON row format from tiepoints-2025.json
interface TiePointRow {
  Province: string;
  Municipality: string;
  'Tie Point': string;
  Lat: number;
  Lon: number;
  Zone: number;
  X: number;
  Y: number;
}

function loadTiePointsFromJson(): TiePoint[] {
  try {
    const raw = require('@/assets/tiepoints-2025.json') as TiePointRow[];
    return raw.map((row, idx) => ({
      id: `tp-${idx}-${row['Tie Point'].replace(/[^a-zA-Z0-9]/g, '-').slice(0, 40)}`,
      name: row['Tie Point'],
      province: row.Province,
      municipality: row.Municipality,
      lat: row.Lat,
      lon: row.Lon,
      zone: row.Zone,
      x: row.X,
      y: row.Y,
    }));
  } catch (err) {
    console.warn('Failed to load tiepoints JSON, using empty fallback:', err);
    return [];
  }
}

// Cache the processed data
let cachedTiePoints: TiePoint[] | null = null;
let cachedProvinces: string[] | null = null;
let cachedMunicipalities: Map<string, string[]> | null = null;
let cachedTiePointsByLocation: Map<string, TiePoint[]> | null = null;

const getTiePoints = (): TiePoint[] => {
  if (!cachedTiePoints) {
    cachedTiePoints = loadTiePointsFromJson();
  }
  return cachedTiePoints;
};

/**
 * Get all unique provinces
 */
export const getProvinces = (): string[] => {
  if (cachedProvinces) {
    return cachedProvinces;
  }

  const tiePoints = getTiePoints();
  const provinces = [...new Set(tiePoints.map((tp) => tp.province))].sort();
  cachedProvinces = provinces;
  return provinces;
};

/**
 * Get municipalities for a specific province
 */
export const getMunicipalities = (province: string): string[] => {
  const key = province.toUpperCase();
  if (cachedMunicipalities && cachedMunicipalities.has(key)) {
    return cachedMunicipalities.get(key)!;
  }

  if (!cachedMunicipalities) {
    cachedMunicipalities = new Map();
  }

  const tiePoints = getTiePoints();
  const municipalities = [
    ...new Set(
      tiePoints
        .filter((tp) => tp.province === key)
        .map((tp) => tp.municipality)
    ),
  ].sort();

  cachedMunicipalities.set(key, municipalities);
  return municipalities;
};

/**
 * Get tie points for a specific province and municipality
 */
export const getTiePointsByLocation = (
  province: string,
  municipality: string
): TiePoint[] => {
  const key = `${province.toUpperCase()}-${municipality.toUpperCase()}`;

  if (cachedTiePointsByLocation && cachedTiePointsByLocation.has(key)) {
    return cachedTiePointsByLocation.get(key)!;
  }

  if (!cachedTiePointsByLocation) {
    cachedTiePointsByLocation = new Map();
  }

  const tiePoints = getTiePoints();
  const filtered = tiePoints.filter(
    (tp) =>
      tp.province === province.toUpperCase() &&
      tp.municipality === municipality.toUpperCase()
  );

  // Sort tie points so BLLM NO. 1 comes first, then sort alphabetically with natural numbers
  filtered.sort((a, b) => {
    // Check if it starts with BLLM NO 1, BLLM 1, BLLM NO. 1, etc.
    const aIsBllm1 = /^BLLM\s*(NO\.?)?\s*1\b/i.test(a.name);
    const bIsBllm1 = /^BLLM\s*(NO\.?)?\s*1\b/i.test(b.name);
    
    if (aIsBllm1 && !bIsBllm1) return -1;
    if (!aIsBllm1 && bIsBllm1) return 1;

    // Natural sort for the rest (so BLLM NO. 2 comes before BLLM NO. 10)
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  cachedTiePointsByLocation.set(key, filtered);
  return filtered;
};

/**
 * Search tie points by name
 */
export const searchTiePoints = (query: string): TiePoint[] => {
  const tiePoints = getTiePoints();
  const searchTerm = query.toLowerCase();

  return tiePoints.filter(
    (tp) =>
      tp.name.toLowerCase().includes(searchTerm) ||
      tp.municipality.toLowerCase().includes(searchTerm) ||
      tp.province.toLowerCase().includes(searchTerm)
  );
};

/**
 * Get a tie point by ID
 */
export const getTiePointById = (id: string): TiePoint | undefined => {
  const tiePoints = getTiePoints();
  return tiePoints.find((tp) => tp.id === id);
};

/**
 * Get nearest tie point to given coordinates
 */
export const getNearestTiePoint = (
  lat: number,
  lon: number,
  province?: string,
  municipality?: string
): TiePoint | null => {
  let tiePoints = getTiePoints();

  // Filter by location if provided
  if (province && municipality) {
    tiePoints = tiePoints.filter(
      (tp) =>
        tp.province === province.toUpperCase() &&
        tp.municipality === municipality.toUpperCase()
    );
  } else if (province) {
    tiePoints = tiePoints.filter((tp) => tp.province === province.toUpperCase());
  }

  if (tiePoints.length === 0) return null;

  // Calculate distances and find nearest
  let nearest = tiePoints[0];
  let minDistance = calculateDistance(lat, lon, nearest.lat, nearest.lon);

  for (const tp of tiePoints) {
    const distance = calculateDistance(lat, lon, tp.lat, tp.lon);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = tp;
    }
  }

  return nearest;
};

// Haversine distance calculation
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export default {
  getProvinces,
  getMunicipalities,
  getTiePointsByLocation,
  searchTiePoints,
  getTiePointById,
  getNearestTiePoint,
};
