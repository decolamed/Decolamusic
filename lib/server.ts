import { NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_KEY } from '@/lib/supabase';

export async function requireUser(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  if (!token) return false;
  const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
  return u.ok;
}

export const JAMENDO_ID = () => process.env.JAMENDO_CLIENT_ID || '';

export async function jamendoTracks(params: Record<string, string>) {
  const url = new URL('https://api.jamendo.com/v3.0/tracks/');
  url.searchParams.set('client_id', JAMENDO_ID());
  url.searchParams.set('format', 'json');
  url.searchParams.set('audioformat', 'mp32');
  url.searchParams.set('audiodlformat', 'mp32');
  url.searchParams.set('imagesize', '300');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString(), { cache: 'no-store' });
  const j = await r.json();
  return (j.results || []) as any[];
}

export const norm = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function parseYouTubeTitle(title: string, channel: string) {
  const clean = title
    .replace(/[\(\[][^\)\]]*[\)\]]/g, ' ')
    .replace(/\b(official|oficial|video|vídeo|clipe|clip|lyrics?|letra|audio|áudio|ao vivo|hd|4k)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  const parts = clean.split(/\s[-–—]\s/);
  const ch = channel.replace(/\s*-\s*topic$/i, '').replace(/vevo$/i, '').trim();
  return parts.length >= 2 ? { artist: parts[0].trim(), song: parts.slice(1).join(' ').trim() } : { artist: ch, song: clean };
}
