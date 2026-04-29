import { getBearerAuth } from '@/lib/auth/api-auth';
import { isDbConfigured } from '@/lib/db/client';
import { createGisPlot, listGisPlotsForUser } from '@/lib/repositories/gis-plots.repository';

export async function GET(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }
  try {
    const rows = await listGisPlotsForUser(auth.userId);
    return Response.json({ success: true, data: rows });
  } catch (e) {
    console.error('gis-plots GET:', e);
    return Response.json({ success: false, message: 'Failed to list plots.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      tie_points?: unknown;
      center_lat?: number | null;
      center_lng?: number | null;
      zoom?: number | null;
      polygon?: unknown;
      area?: number | null;
      perimeter?: number | null;
    };

    const id = await createGisPlot({
      user_id: auth.userId,
      tie_points: body.tie_points,
      center_lat: body.center_lat,
      center_lng: body.center_lng,
      zoom: body.zoom,
      polygon: body.polygon,
      area: body.area,
      perimeter: body.perimeter,
    });

    return Response.json({ success: true, data: { Gis_id: id } }, { status: 201 });
  } catch (e) {
    console.error('gis-plots POST:', e);
    return Response.json({ success: false, message: 'Failed to save plot.' }, { status: 500 });
  }
}
