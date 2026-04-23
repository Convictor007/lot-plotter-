import { getBearerAuth } from '@/lib/auth/api-auth';
import { paramId } from '@/lib/api/route-params';
import { isDbConfigured } from '@/lib/db/client';
import { findGisPlotById, updateGisPlot } from '@/lib/repositories/gis-plots.repository';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const idStr = await paramId(ctx, 'id');
  const gisId = Number(idStr);
  if (!idStr || !Number.isFinite(gisId)) {
    return Response.json({ success: false, message: 'Invalid id.' }, { status: 400 });
  }

  try {
    const row = await findGisPlotById(gisId);
    if (!row || row.user_id !== auth.userId) {
      return Response.json({ success: false, message: 'Not found.' }, { status: 404 });
    }
    return Response.json({ success: true, data: row });
  } catch (e) {
    console.error('gis-plots/[id] GET:', e);
    return Response.json({ success: false, message: 'Failed to load plot.' }, { status: 500 });
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isDbConfigured()) {
    return Response.json({ success: false, code: 'DB_NOT_CONFIGURED' }, { status: 503 });
  }
  const auth = await getBearerAuth(req);
  if (!auth) {
    return Response.json({ success: false, message: 'Unauthorized.' }, { status: 401 });
  }

  const idStr = await paramId(ctx, 'id');
  const gisId = Number(idStr);
  if (!idStr || !Number.isFinite(gisId)) {
    return Response.json({ success: false, message: 'Invalid id.' }, { status: 400 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const ok = await updateGisPlot(gisId, auth.userId, {
      transaction_request_id: body.transaction_request_id as number | null | undefined,
      barangay: body.barangay as string | null | undefined,
      municipality: body.municipality as string | null | undefined,
      province: body.province as string | null | undefined,
      tie_points: body.tie_points,
      center_lat: body.center_lat as number | null | undefined,
      center_lng: body.center_lng as number | null | undefined,
      zoom: body.zoom as number | null | undefined,
      polygon: body.polygon,
      area: body.area as number | null | undefined,
      perimeter: body.perimeter as number | null | undefined,
      historical_comparison_notes: body.historical_comparison_notes as string | null | undefined,
    });
    if (!ok) {
      return Response.json({ success: false, message: 'Not found or no changes.' }, { status: 400 });
    }
    const row = await findGisPlotById(gisId);
    return Response.json({ success: true, data: row });
  } catch (e) {
    console.error('gis-plots/[id] PATCH:', e);
    return Response.json({ success: false, message: 'Failed to update plot.' }, { status: 500 });
  }
}
