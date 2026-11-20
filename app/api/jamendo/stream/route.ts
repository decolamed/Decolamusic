import { NextRequest, NextResponse } from 'next/server';
import { requireUser, JAMENDO_ID, jamendoTracks } from '@/lib/server';

export async function GET(req: NextRequest) {
  if (!(await requireUser(req))) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!JAMENDO_ID()) return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  const id = (req.nextUrl.searchParams.get('id') || '').replace(/^jm:/, '').replace(/\D/g, '');
  const [t] = await jamendoTracks({ id });
  if (!t?.audio) return NextResponse.json({ error: 'Faixa indisponível' }, { status: 404 });
  return NextResponse.json({ url: t.audio });
}
