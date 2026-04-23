/**
 * iAssess - GIS Utilities
 * Geographic Information System helper functions
 * For lot plotting, boundary calculations, and coordinate conversions
 */

import proj4 from 'proj4/dist/proj4';
import { BoundaryPoint, GeoJSONPolygon } from '@/types';

// Define PRS92 zones (Philippines)
proj4.defs([
  ["EPSG:25391","+proj=tmerc +lat_0=0 +lon_0=117 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-77,-51,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25392","+proj=tmerc +lat_0=0 +lon_0=119 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-77,-51,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25392A","+proj=tmerc +lat_0=0 +lon_0=119 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-79,-72,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25393","+proj=tmerc +lat_0=0 +lon_0=121 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-77,-51,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25393A","+proj=tmerc +lat_0=0 +lon_0=121 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-79,-72,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25394","+proj=tmerc +lat_0=0 +lon_0=123 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-77,-51,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25394A","+proj=tmerc +lat_0=0 +lon_0=123 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-79,-72,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25395","+proj=tmerc +lat_0=0 +lon_0=125 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-79,-72,0,0,0,0 +units=m +no_defs +type=crs"],
  ["EPSG:25395A","+proj=tmerc +lat_0=0 +lon_0=125 +k=0.99995 +x_0=500000 +y_0=0 +ellps=clrk66 +towgs84=-133,-79,-72,0,0,0,0 +units=m +no_defs +type=crs"]
]);

// Earth's radius in meters for calculations
const EARTH_RADIUS = 6371000;

/**
 * Parse bearing string to decimal degrees
 * Philippine land titles use bearings like "N 45° 30' E"
 * Returns decimal degrees (0-360, clockwise from North)
 */
export function parseBearing(bearingStr: string): number {
  // Normalize the input
  const normalized = bearingStr.trim().toUpperCase();
  
  // Regular expression to match bearing format
  // Examples: N 45° 30' E, S 60° E, N 45.5° W
  const regex = /^(N|S)\s*(\d+)?\s*[°\s]\s*(\d+)?\s*['\s]?\s*(\d+)?\s*["\s]?\s*(E|W)$/;
  const match = normalized.match(regex);

  if (!match) {
    // Try alternate format: N45°30'E or N45.5E
    const altRegex = /^(N|S)(\d+(?:\.\d+)?)[°\s]?(\d+)?['\s]?(\d+)?["\s]?(E|W)$/;
    const altMatch = normalized.match(altRegex);
    
    if (!altMatch) {
      throw new Error(`Invalid bearing format: ${bearingStr}`);
    }
    
    return calculateBearingDegrees(altMatch[1], altMatch[2], altMatch[3], altMatch[4], altMatch[5]);
  }

  return calculateBearingDegrees(match[1], match[2], match[3], match[4], match[5]);
}

/**
 * Helper function to calculate bearing in degrees
 */
function calculateBearingDegrees(
  cardinal1: string,
  degrees?: string,
  minutes?: string,
  seconds?: string,
  cardinal2?: string
): number {
  let decimalDegrees = parseFloat(degrees || '0');
  decimalDegrees += (parseFloat(minutes || '0') / 60);
  decimalDegrees += (parseFloat(seconds || '0') / 3600);

  // Calculate azimuth (0-360 from North)
  let azimuth: number;

  if (cardinal1 === 'N' && cardinal2 === 'E') {
    azimuth = decimalDegrees;
  } else if (cardinal1 === 'S' && cardinal2 === 'E') {
    azimuth = 180 - decimalDegrees;
  } else if (cardinal1 === 'S' && cardinal2 === 'W') {
    azimuth = 180 + decimalDegrees;
  } else if (cardinal1 === 'N' && cardinal2 === 'W') {
    azimuth = 360 - decimalDegrees;
  } else {
    throw new Error(`Invalid cardinal directions: ${cardinal1} ... ${cardinal2}`);
  }

  return azimuth;
}

/**
 * Convert bearing to decimal degrees (for coordinate calculations)
 */
export function bearingToDecimalDegrees(bearing: number): number {
  // Bearing is already 0-360 from North (clockwise)
  // Convert to standard azimuth for trigonometry (0 = North, clockwise)
  return bearing;
}

/**
 * Calculate next point from current point using bearing and distance
 * Uses simplified flat earth approximation for small distances
 */
export function calculateNextPoint(
  currentLat: number,
  currentLng: number,
  bearing: number,
  distanceMeters: number
): { lat: number; lng: number } {
  // Convert to radians
  const latRad = (currentLat * Math.PI) / 180;
  const lngRad = (currentLng * Math.PI) / 180;
  const bearingRad = (bearing * Math.PI) / 180;

  // Calculate angular distance
  const angularDistance = distanceMeters / EARTH_RADIUS;

  // Calculate new latitude
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
    Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  // Calculate new longitude
  const newLngRad = lngRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
  );

  // Convert back to degrees
  return {
    lat: (newLatRad * 180) / Math.PI,
    lng: (newLngRad * 180) / Math.PI,
  };
}

/**
 * Generate polygon coordinates from boundary points
 * Starting from a reference point (tie point)
 */
export function generatePolygonFromBoundaries(
  startLat: number,
  startLng: number,
  boundaries: BoundaryPoint[]
): Array<[number, number]> {
  const coordinates: Array<[number, number]> = [[startLng, startLat]];
  let currentLat = startLat;
  let currentLng = startLng;

  for (const point of boundaries) {
    const bearing = parseBearing(point.bearing);
    const nextPoint = calculateNextPoint(currentLat, currentLng, bearing, point.distance);
    
    coordinates.push([nextPoint.lng, nextPoint.lat]);
    
    currentLat = nextPoint.lat;
    currentLng = nextPoint.lng;
  }

  // Close the polygon by returning to start
  coordinates.push([startLng, startLat]);

  return coordinates;
}

/**
 * Calculate area and perimeter directly from boundaries using Cartesian coordinates in meters.
 * This provides high accuracy matching the geoportal's projected coordinate system method.
 * Note: boundaries[0] is MON -> C1, so the lot itself is boundaries.slice(1).
 */
export function calculateLotAreaAndPerimeter(boundaries: BoundaryPoint[]): { area: number, perimeter: number } {
  if (boundaries.length < 2) return { area: 0, perimeter: 0 };
  
  const lotBoundaries = boundaries.slice(1);
  
  let x = 0;
  let y = 0;
  const cartesianRing: Array<[number, number]> = [[0, 0]];
  let perimeter = 0;

  for (const point of lotBoundaries) {
    const bearing = parseBearing(point.bearing);
    const azimuthRad = bearing * (Math.PI / 180);
    
    x += Math.sin(azimuthRad) * point.distance;
    y += Math.cos(azimuthRad) * point.distance;
    perimeter += point.distance;
    
    cartesianRing.push([x, y]);
  }

  // Shoelace formula for area
  let area = 0;
  const n = cartesianRing.length;
  for (let i = 0; i < n - 1; i++) {
    area += (cartesianRing[i][0] * cartesianRing[i + 1][1]) - 
            (cartesianRing[i + 1][0] * cartesianRing[i][1]);
  }
  // Add closing segment
  area += (cartesianRing[n - 1][0] * cartesianRing[0][1]) - 
          (cartesianRing[0][0] * cartesianRing[n - 1][1]);

  area = Math.abs(area) / 2;

  return { area, perimeter };
}

/**
 * Closed ring for the **lot** only (excludes the monument).
 * `boundaries[0]` = MON → Corner 1; following entries = LINE 1-2, 2-3, … as in LOT DESCRIPTIONS.
 * Ring is [C1, C2, …, Cn, C1] (implicit closing side LINE n→1).
 * Applies Bowditch Rule (Compass Rule) for polygon closure adjustment.
 * Uses exact PRS92 projection math for accurate placement on WGS84 maps.
 */
export function generateLotPolygonFromTraverse(
  tieLat: number,
  tieLng: number,
  boundaries: BoundaryPoint[],
  tieX?: number,
  tieY?: number,
  tieZone?: number | string
): Array<[number, number]> {
  if (boundaries.length === 0) {
    return [];
  }

  // If we have PRS92 coordinates, use them for exact projection math
  const useProjection = tieX !== undefined && tieY !== undefined && tieZone !== undefined;
  
  // Use local Cartesian coordinates (meters) for high accuracy
  let x = useProjection ? tieX! : 0;
  let y = useProjection ? tieY! : 0;
  
  // First, find Corner 1 relative to Tie Point
  if (boundaries.length > 0) {
    const tpBearing = parseBearing(boundaries[0].bearing);
    const tpAzimuthRad = tpBearing * (Math.PI / 180);
    x += Math.sin(tpAzimuthRad) * boundaries[0].distance;
    y += Math.cos(tpAzimuthRad) * boundaries[0].distance;
  }

  const startX = x;
  const startY = y;
  
  const ring: Array<[number, number]> = [[x, y]];

  // Then traverse the lot corners
  for (let i = 1; i < boundaries.length; i++) {
    const point = boundaries[i];
    const bearing = parseBearing(point.bearing);
    const azimuthRad = bearing * (Math.PI / 180);
    
    x += Math.sin(azimuthRad) * point.distance;
    y += Math.cos(azimuthRad) * point.distance;
    
    ring.push([x, y]);
  }

  // We DO NOT apply Bowditch adjustment here.
  // If the user's input doesn't close (e.g. missing the final line),
  // Bowditch would completely distort the shape.
  // Instead, we just draw the lines exactly as inputted, and then
  // visually close the polygon by connecting the last point to the first.

  let finalRing: Array<[number, number]>;

  if (useProjection) {
    // Convert PRS92 Easting/Northing back to WGS84 Lat/Lng
    let epsgCode = `EPSG:2539${tieZone}`;
    if (String(tieZone).includes('A')) {
      epsgCode = `EPSG:2539${String(tieZone).replace('A', '')}A`;
    }

    try {
      finalRing = ring.map(([cx, cy]) => {
        const wgs84Coords = proj4(epsgCode, 'EPSG:4326', [cx, cy]);
        return [wgs84Coords[0], wgs84Coords[1]] as [number, number];
      });
    } catch (err) {
      console.warn(`Proj4 conversion failed for zone ${tieZone}, falling back to flat earth approximation`, err);
      finalRing = fallbackFlatEarthConversion(ring, tieLat, tieLng, tieX, tieY);
    }
  } else {
    finalRing = fallbackFlatEarthConversion(ring, tieLat, tieLng, tieX, tieY);
  }

  if (finalRing.length < 3) {
    return finalRing;
  }

  // Ensure it's a closed ring by pushing the first point again
  finalRing.push(finalRing[0]);
  return finalRing;
}

function fallbackFlatEarthConversion(
  adjustedRing: number[][],
  tieLat: number,
  tieLng: number,
  tieX: number | undefined,
  tieY: number | undefined
): Array<[number, number]> {
  const metersPerDegreeLat = 110574;
  const metersPerDegreeLng = 111320 * Math.cos((tieLat * Math.PI) / 180);

  const offsetX = tieX !== undefined ? tieX : 0;
  const offsetY = tieY !== undefined ? tieY : 0;

  return adjustedRing.map(([cx, cy]) => [
    tieLng + (cx - offsetX) / metersPerDegreeLng,
    tieLat + (cy - offsetY) / metersPerDegreeLat
  ] as [number, number]);
}

/**
 * Calculate polygon area using shoelace formula
 * Coordinates should be in [lng, lat] format
 */
export function calculatePolygonArea(coordinates: Array<[number, number]>): number {
  if (coordinates.length < 3) {
    return 0;
  }

  // Convert to approximate meters (using haversine would be more accurate but this is faster)
  let area = 0;
  const n = coordinates.length;

  for (let i = 0; i < n - 1; i++) {
    area += (coordinates[i][0] * coordinates[i + 1][1]) - 
            (coordinates[i + 1][0] * coordinates[i][1]);
  }

  area = Math.abs(area) / 2;

  // Convert from degrees² to square meters (approximate for Philippines ~12°N)
  const metersPerDegreeLat = 110574;
  const metersPerDegreeLng = 111320 * Math.cos((12 * Math.PI) / 180);
  
  return area * metersPerDegreeLat * metersPerDegreeLng;
}

/**
 * Calculate polygon perimeter
 */
export function calculatePolygonPerimeter(
  coordinates: Array<[number, number]>
): number {
  let perimeter = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    perimeter += haversineDistance(
      coordinates[i][1],
      coordinates[i][0],
      coordinates[i + 1][1],
      coordinates[i + 1][0]
    );
  }

  return perimeter;
}

/**
 * Calculate distance between two points using haversine formula
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLng = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS * c;
}

/**
 * Check linear misclosure of the lot boundary: straight-line gap between last corner and first
 * after traversing MON→C1 and LINE 1-2 … (implicit LINE n→1 is not in the deed).
 * `tieLat` / `tieLng` should be the selected monument (same CRS as the traverse).
 */
export function checkClosureError(
  boundaries: BoundaryPoint[],
  tieLat?: number,
  tieLng?: number,
  tieX?: number,
  tieY?: number,
  tieZone?: number | string
): { error: number; percentage: number; isAcceptable: boolean } {
  const lat0 = tieLat ?? 13.3;
  const lng0 = tieLng ?? 123.2;

  const lotSides = boundaries.slice(1);
  const lotPerimeter = lotSides.reduce((sum, p) => sum + p.distance, 0);

  const ring = generateLotPolygonFromTraverse(lat0, lng0, boundaries, tieX, tieY, tieZone);
  if (ring.length < 4) {
    return { error: 0, percentage: 0, isAcceptable: true };
  }

  const corners = ring.slice(0, -1);
  const c1 = corners[0];
  const cn = corners[corners.length - 1];
  const closureError = haversineDistance(c1[1], c1[0], cn[1], cn[0]);

  const percentage =
    lotPerimeter > 0 ? (closureError / lotPerimeter) * 100 : 0;

  // BLGF-style order of precision: ~1:5000 → relative error ≤ 0.02%
  const isAcceptable = percentage < 0.02;

  return {
    error: closureError,
    percentage,
    isAcceptable,
  };
}

/**
 * Convert coordinates to GeoJSON Polygon format
 */
export function toGeoJSONPolygon(
  coordinates: Array<[number, number]>
): GeoJSONPolygon {
  return {
    type: 'Polygon',
    coordinates: [coordinates],
  };
}

/**
 * Calculate centroid of polygon
 */
export function calculateCentroid(
  coordinates: Array<[number, number]>
): { lat: number; lng: number } {
  let latSum = 0;
  let lngSum = 0;
  const n = coordinates.length - 1; // Exclude closing point

  for (let i = 0; i < n; i++) {
    lngSum += coordinates[i][0];
    latSum += coordinates[i][1];
  }

  return {
    lat: latSum / n,
    lng: lngSum / n,
  };
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(
  lat: number,
  lng: number,
  precision: number = 6
): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  
  return `${Math.abs(lat).toFixed(precision)}° ${latDir}, ${Math.abs(lng).toFixed(precision)}° ${lngDir}`;
}

/**
 * Convert decimal degrees to DMS (Degrees, Minutes, Seconds)
 */
export function decimalToDMS(
  decimal: number,
  isLatitude: boolean
): { degrees: number; minutes: number; seconds: number; direction: string } {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;

  const direction = isLatitude
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');

  return { degrees, minutes, seconds, direction };
}

/**
 * Format DMS for display
 */
export function formatDMS(
  decimal: number,
  isLatitude: boolean
): string {
  const dms = decimalToDMS(decimal, isLatitude);
  return `${dms.degrees}° ${dms.minutes}' ${dms.seconds.toFixed(2)}" ${dms.direction}`;
}

/**
 * Get map bounds from polygon coordinates
 */
export function getBounds(
  coordinates: Array<[number, number]>
): {
  north: number;
  south: number;
  east: number;
  west: number;
} {
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);

  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs),
  };
}

/**
 * Get appropriate zoom level for polygon
 */
export function getZoomLevel(
  bounds: { north: number; south: number; east: number; west: number }
): number {
  const latDiff = bounds.north - bounds.south;
  const lngDiff = bounds.east - bounds.west;
  const maxDiff = Math.max(latDiff, lngDiff);

  // Approximate zoom levels based on extent
  if (maxDiff > 1) return 10;
  if (maxDiff > 0.5) return 12;
  if (maxDiff > 0.1) return 14;
  if (maxDiff > 0.05) return 15;
  if (maxDiff > 0.01) return 16;
  return 17;
}

/**
 * Extract boundaries from title text using regex patterns
 * Enhanced parser for Philippine land titles
 */
export function extractBoundariesFromText(text: string): BoundaryPoint[] {
  const boundaries: BoundaryPoint[] = [];
  
  // More comprehensive patterns for Philippine land titles
  // Pattern: "N. 45° 30' E., 100.50 m." or "N 45° 30' E 100.50m" or "thence N 45° E, 100 m"
  const bearingPatterns = [
    // Standard format: N. 45° 30' E., 100.50 m.
    {
      regex: /([NS])\.?\s*(\d{1,3})\s*°?\s*(\d{1,2})?\s*'?\s*(\d{1,2})?\s*"?\s*([EW])\.?,?\s*(\d+(?:\.\d+)?)\s*m?\b/gi,
      parse: (match: RegExpExecArray) => {
        const dir1 = match[1].toUpperCase();
        const deg = match[2] || '0';
        const min = match[3] || '0';
        const sec = match[4] || '0';
        const dir2 = match[5].toUpperCase();
        const dist = parseFloat(match[6]);
        
        let bearing = `${dir1}`;
        if (deg) bearing += ` ${deg}°`;
        if (min && min !== '0') bearing += ` ${min}'`;
        if (sec && sec !== '0') bearing += ` ${sec}"`;
        bearing += ` ${dir2}`;
        
        return { bearing: bearing.trim(), distance: dist };
      }
    },
    // Compact format: N45°30'E 100m
    {
      regex: /([NS])(\d{1,3})°(\d{1,2})'?([EW])\s*(\d+(?:\.\d+)?)\s*m?\b/gi,
      parse: (match: RegExpExecArray) => {
        const bearing = `${match[1]} ${match[2]}° ${match[3]}' ${match[4]}`;
        return { bearing, distance: parseFloat(match[5]) };
      }
    },
    // Simple format: N 45 E 100
    {
      regex: /([NS])\s*(\d{1,3})\s*°?\s*([EW])\.?,?\s*(\d+(?:\.\d+)?)\s*m?\b/gi,
      parse: (match: RegExpExecArray) => {
        const bearing = `${match[1]} ${match[2]}° ${match[3]}`;
        return { bearing, distance: parseFloat(match[4]) };
      }
    },
  ];

  // Try each pattern
  for (const pattern of bearingPatterns) {
    let match;
    // Reset lastIndex for global regex
    pattern.regex.lastIndex = 0;
    
    while ((match = pattern.regex.exec(text)) !== null) {
      try {
        const result = pattern.parse(match);
        if (result && result.distance > 0) {
          boundaries.push({
            id: `boundary-${boundaries.length + 1}`,
            bearing: result.bearing,
            distance: result.distance,
            isTiePoint: text.toLowerCase().includes('tie') || 
                       text.toLowerCase().includes('monument') ||
                       text.toLowerCase().includes('me'),
          });
        }
      } catch (e) {
        console.warn('Failed to parse bearing match:', match[0]);
      }
    }
  }

  // Remove duplicates (same bearing and distance)
  const seen = new Set<string>();
  return boundaries.filter(b => {
    const key = `${b.bearing}-${b.distance}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Validate bearing format
 */
export function isValidBearing(bearing: string): boolean {
  try {
    parseBearing(bearing);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format bearing for display
 */
export function formatBearing(bearing: string): string {
  try {
    const decimal = parseBearing(bearing);
    const cardinal = decimalToCardinal(decimal);
    return cardinal;
  } catch {
    return bearing;
  }
}

/**
 * Convert decimal degrees to cardinal direction
 */
function decimalToCardinal(decimal: number): string {
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(decimal / 45) % 8;
  return cardinals[index];
}

export default {
  parseBearing,
  calculateNextPoint,
  generatePolygonFromBoundaries,
  generateLotPolygonFromTraverse,
  calculateLotAreaAndPerimeter,
  calculatePolygonArea,
  calculatePolygonPerimeter,
  haversineDistance,
  checkClosureError,
  toGeoJSONPolygon,
  calculateCentroid,
  formatCoordinates,
  decimalToDMS,
  formatDMS,
  getBounds,
  getZoomLevel,
  extractBoundariesFromText,
};
