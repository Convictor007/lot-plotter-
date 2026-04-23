/**
 * Map Nominatim reverse-geocode payloads to Philippine-style address parts (best-effort).
 */

export type ParsedPhAddress = {
  street: string | null;
  barangay: string | null;
  municipality: string | null;
  province: string | null;
  region: string | null;
  postal_code: string | null;
  display_name: string;
};

/** Rough Luzon/Visayas/Mindanao grouping for common provinces (extend as needed). */
const PROVINCE_TO_REGION: Record<string, string> = {
  'Camarines Norte': 'South Luzon',
  'Camarines Sur': 'South Luzon',
  Albay: 'South Luzon',
  Sorsogon: 'South Luzon',
  Catanduanes: 'South Luzon',
  Masbate: 'South Luzon',
  Quezon: 'South Luzon',
  Laguna: 'South Luzon',
  Batangas: 'South Luzon',
  Cavite: 'South Luzon',
  Rizal: 'South Luzon',
  'Metro Manila': 'National Capital Region',
  Manila: 'National Capital Region',
  Cebu: 'Central Visayas',
  Bohol: 'Central Visayas',
  Leyte: 'Eastern Visayas',
  Davao: 'Davao Region',
};

function firstNonEmpty(...vals: (string | undefined | null)[]): string | null {
  for (const v of vals) {
    const s = v?.trim();
    if (s) return s;
  }
  return null;
}

export function parseNominatimToPhAddress(payload: {
  display_name?: string;
  address?: Record<string, string>;
}): ParsedPhAddress {
  const a = payload.address || {};
  const display_name = payload.display_name || '';

  const road = firstNonEmpty(a.road, a.pedestrian, a.path, a.residential);
  const quarter = firstNonEmpty(a.quarter, a.hamlet);
  let barangay = firstNonEmpty(a.village, a.suburb, a.neighbourhood, a.city_district);
  if (quarter) {
    if (barangay && !barangay.includes(quarter)) barangay = `${barangay} (${quarter})`;
    else if (!barangay) barangay = quarter;
  }
  const municipality = firstNonEmpty(
    a.city,
    a.town,
    a.municipality,
    a.county,
    a.city_district
  );
  let province = firstNonEmpty(a.state, a.region);
  if (province === municipality) province = firstNonEmpty(a.county, a.state_district);

  const postal_code = firstNonEmpty(a.postcode) || null;
  const provKey = province || '';
  const region =
    (provKey && PROVINCE_TO_REGION[provKey]) ||
    firstNonEmpty(a.state_district, a.region) ||
    null;

  return {
    street: road,
    barangay,
    municipality,
    province,
    region,
    postal_code,
    display_name,
  };
}
