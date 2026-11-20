import { NextRequest, NextResponse } from 'next/server';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase';

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  if (!u.ok) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 });

  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return NextResponse.json({ items: [] });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: 'YOUTUBE_API_KEY não configurada' }, { status: 500 });

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoCategoryId', '10');
  url.searchParams.set('videoEmbeddable', 'true');
  url.searchParams.set('maxResults', '20');
  url.searchParams.set('q', q);
  url.searchParams.set('key', key);
  const r = await fetch(url.toString(), { next: { revalidate: 3600 } });
  const j = await r.json();
  if (!r.ok) return NextResponse.json({ error: j?.error?.message || 'Erro na API do YouTube' }, { status: 502 });
  const items = (j.items || []).map((i: any) => ({
    video_id: i.id.videoId,
    title: decode(i.snippet.title),
    channel: decode(i.snippet.channelTitle),
    thumbnail: i.snippet.thumbnails?.high?.url || i.snippet.thumbnails?.medium?.url || ''
  }));
  return NextResponse.json({ items });
}
