import { NextRequest, NextResponse } from 'next/server';
import { requireUser, JAMENDO_ID, jamendoTracks } from '@/lib/server';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!JAMENDO_ID()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const id = (req.nextUrl.searchParams.get('id') || '').replace(/^jm:/, '').replace(/\D/g, '');
  const [t] = await jamendoTracks({ id });
  if (!t || !t.audiodownload_allowed || !t.audiodownload) return NextResponse.json({ error: 'Download não autorizado para esta faixa' }, { status: 403 });
  const host = new URL(t.audiodownload).hostname;
  if (!host.endsWith('jamendo.com')) return NextResponse.json({ error: 'Origem inválida' }, { status: 400 });
  const r = await fetch(t.audiodownload);
  if (!r.ok || !r.body) return NextResponse.json({ error: 'Falha ao obter o arquivo' }, { status: 502 });
  const headers: Record<string, string> = { 'Content-Type': r.headers.get('content-type') || 'audio/mpeg', 'Cache-Control': 'no-store' };
  const len = r.headers.get('content-length');
  if (len) headers['Content-Length'] = len;
  return new Response(r.body, { headers });
}
