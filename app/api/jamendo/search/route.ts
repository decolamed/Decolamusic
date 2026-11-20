import { NextRequest, NextResponse } from 'next/server';
import { requireUser, JAMENDO_ID, jamendoTracks } from '@/lib/server';

export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!JAMENDO_ID()) return NextResponse.json({ error: 'Catálogo livre não configurado (falta JAMENDO_CLIENT_ID).' }, { status: 503 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return NextResponse.json({ items: [] });
  try {
    const res = await jamendoTracks({ search: q, limit: '20' });
    return NextResponse.json({
      items: res.map((t) => ({ video_id: 'jm:' + t.id, title: t.name, channel: t.artist_name, thumbnail: t.image || t.album_image || '', duration: t.duration || 0 }))
    });
  } catch {
    return NextResponse.json({ error: 'Catálogo indisponível no momento.' }, { status: 502 });
  }
}
