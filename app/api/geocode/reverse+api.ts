import { parseNominatimToPhAddress } from '@/lib/geocode/nominatim-ph';

const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';

/**
 * Reverse geocode (OpenStreetMap Nominatim). Use for map pin → address fields.
 * Respect usage policy: low volume / dev; for production add caching or a commercial provider.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lat = parseFloat(url.searchParams.get('lat') || '');
    const lng = parseFloat(url.searchParams.get('lng') || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ success: false, message: 'Query parameters lat and lng are required.' }, { status: 400 });
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return Response.json({ success: false, message: 'Invalid coordinates.' }, { status: 400 });
    }

    const nominatimUrl = `${NOMINATIM}?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&format=json&addressdetails=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'iAssess/1.0 (property assessment; local development)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return Response.json(
        { success: false, message: 'Geocoding service unavailable. Try again.' },
        { status: 502 }
      );
    }
    const payload = (await res.json()) as { display_name?: string; address?: Record<string, string> };
    const address = parseNominatimToPhAddress(payload);

    return Response.json({
      success: true,
      lat,
      lng,
      address: {
        street: address.street,
        barangay: address.barangay,
        municipality: address.municipality,
        province: address.province,
        region: address.region,
        postal_code: address.postal_code,
        formatted: address.display_name,
      },
    });
  } catch (e) {
    console.error('geocode/reverse:', e);
    return Response.json({ success: false, message: 'Reverse geocode failed.' }, { status: 500 });
  }
}
