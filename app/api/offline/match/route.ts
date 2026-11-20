import { NextRequest, NextResponse } from 'next/server';
import { requireUser, JAMENDO_ID, jamendoTracks, norm, parseYouTubeTitle } from '@/lib/server';

// Só confirma correspondência quando título, artista e duração batem. Sem ISRC disponível no Jamendo.
export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!JAMENDO_ID()) return NextResponse.json({ available: false, reason: 'not_configured' });
  const sp = req.nextUrl.searchParams;
  const title = sp.get('title') || '';
  const channel = sp.get('channel') || '';
  const vid = sp.get('vid') || '';
  let duration = +(sp.get('duration') || 0);
  if (!duration && vid && process.env.YOUTUBE_API_KEY) {
    try {
      const d = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${encodeURIComponent(vid)}&key=${process.env.YOUTUBE_API_KEY}`)).json();
      const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d.items?.[0]?.contentDetails?.duration || '');
      if (m) duration = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
    } catch {}
  }
  if (!duration) return NextResponse.json({ available: false, reason: 'no_duration' });
  const { artist, song } = parseYouTubeTitle(title, channel);
  if (!song) return NextResponse.json({ available: false, reason: 'no_title' });
  try {
    const res = await jamendoTracks({ search: song, limit: '30', include: 'licenses' });
    const a = norm(artist), c = norm(channel), s = norm(song);
    const hit = res.find((t) => {
      const ja = norm(t.artist_name);
      const artistOk = ja && (a.includes(ja) || ja.includes(a) || c.includes(ja));
      return norm(t.name) === s && artistOk && Math.abs((t.duration || 0) - duration) <= 3 && t.audiodownload_allowed && t.audiodownload;
    });
    if (!hit) return NextResponse.json({ available: false, reason: 'no_match' });
    return NextResponse.json({ available: true, id: hit.id, name: hit.name, artist: hit.artist_name, duration: hit.duration, license: hit.license_ccurl || '' });
  } catch {
    return NextResponse.json({ available: false, reason: 'catalog_error' });
  }
}
