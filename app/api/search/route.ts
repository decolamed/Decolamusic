import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server';

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const iso = (d: string) => { const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || ''); return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0; };

export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return NextResponse.json({ items: [] });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: 'YOUTUBE_API_KEY não configurada' }, { status: 500 });

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('maxResults', req.nextUrl.searchParams.get('n') || '20');
  url.searchParams.set('q', q);
  url.searchParams.set('key', key);
  const r = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const j = await r.json();
  if (!r.ok) return NextResponse.json({ error: j?.error?.message || 'Erro na API do YouTube' }, { status: r.status === 403 ? 429 : 502 });
  let items = (j.items || []).map((i: any) => ({
    video_id: i.id.videoId,
    title: decode(i.snippet.title),
    channel: decode(i.snippet.channelTitle),
    thumbnail: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || '',
    duration: 0
  }));
  try {
    const d = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${items.map((x: any) => x.video_id).join(',')}&key=${key}`, { next: { revalidate: 3600 } });
    const dj = await d.json();
    const map: Record<string, number> = {};
    (dj.items || []).forEach((v: any) => (map[v.id] = iso(v.contentDetails?.duration)));
    items = items.map((x: any) => ({ ...x, duration: map[x.video_id] || 0 }));
  } catch {}
  return NextResponse.json({ items });
}
