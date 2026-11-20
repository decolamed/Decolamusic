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
