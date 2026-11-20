'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { supabase, Track, Playlist } from '@/lib/supabase';
import { Icon, Cover, Modal, btnAccent, btnPrimary, inputCls } from './Ui';
import { useData } from './Data';
import { useOffline, authHeader } from './Offline';
import { usePlayer } from './Player';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ---------------- Downloads ---------------- */
export function DownloadsView({ go }: { go: (v: any) => void }) {
  const { local, jobs, cancel, remove, dismiss, online } = useOffline();
  const { play, current, playing } = usePlayer();
  const items: Track[] = Object.values(local).sort((a, b) => b.created - a.created).map((m) => ({ video_id: m.key, title: m.title, channel: m.channel, thumbnail: m.thumbnail, duration: m.duration }));
  const active = Object.entries(jobs).filter(([k, j]) => j.status !== 'done' && !local[k]);
  return (
    <div className="animate-fadeIn">
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-3xl font-extrabold">Downloads</h1><p className="text-white/50 text-sm">{items.length} músicas neste dispositivo {online ? '' : '• offline'}</p></div>
        <button disabled={!items.length} onClick={() => play(items, 0)} className="bg-brand-orange text-black rounded-full w-14 h-14 grid place-items-center disabled:opacity-40"><Icon n="play" fill s={26} /></button>
      </div>
      {active.map(([k, j]) => (
        <div key={k} className="bg-surface-2 rounded-xl p-3 mb-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-semibold">{j.title}</p>
            {j.status === 'error' ? <button onClick={() => dismiss(k)} className="text-white/50"><Icon n="x" s={18} /></button> : <button onClick={() => cancel(k)} className="text-xs text-brand-orange">Cancelar</button>}
          </div>
          {j.status === 'error' ? <p className="text-sm text-red-400 mt-1">{j.msg}</p> : (
            <>
              <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden"><div className={`h-full bg-brand-orange ${j.progress < 0 || j.status === 'matching' ? 'w-1/3 animate-pulse' : ''}`} style={j.progress >= 0 && j.status === 'downloading' ? { width: j.progress * 100 + '%' } : undefined} /></div>
              <p className="text-xs text-white/50 mt-1">{j.status === 'matching' ? 'Procurando gravação autorizada…' : j.progress >= 0 ? `Baixando ${Math.round(j.progress * 100)}%` : 'Baixando…'}</p>
            </>
          )}
        </div>
      ))}
      {items.map((t, i) => (
        <div key={t.video_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
          <button onClick={() => play(items, i)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
            <Cover src={t.thumbnail} size="w-14" className="rounded-lg" />
            <div className="min-w-0">
              <p className={`truncate font-semibold ${current?.video_id === t.video_id && playing ? 'text-brand-orange' : ''}`}>{t.title}</p>
              <p className="truncate text-sm text-white/50">{t.channel}{t.duration ? ' • ' + fmt(t.duration) : ''}</p>
              <p className="text-xs text-emerald-400">Baixada ✓{local[t.video_id]?.license ? ' • licença aberta' : ''}</p>
            </div>
          </button>
          <button onClick={() => remove(t.video_id)} className="text-white/40 hover:text-red-400 p-1"><Icon n="trash" s={20} /></button>
        </div>
      ))}
      {!items.length && !active.length && <p className="text-white/50">Nada baixado ainda. Use o menu ⋮ de uma música → “Baixar para ouvir offline”. Só gravações com licença que permite download ficam disponíveis.</p>}
    </div>
  );
}

/* ---------------- Spotify ---------------- */
const SP_CLIENT = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID || '';
const SP_KEY = 'dm-spotify';
const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = (n: number) => b64(crypto.getRandomValues(new Uint8Array(n)).buffer);
const redirectUri = () => window.location.origin + '/';
const tokens = () => { try { return JSON.parse(localStorage.getItem(SP_KEY) || 'null'); } catch { return null; } };

async function spLogin() {
  const verifier = rand(48), state = rand(12);
  const challenge = b64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  localStorage.setItem('dm-sp-v', verifier); localStorage.setItem('dm-sp-s', state);
  const p = new URLSearchParams({ client_id: SP_CLIENT, response_type: 'code', redirect_uri: redirectUri(), scope: 'playlist-read-private playlist-read-collaborative', code_challenge_method: 'S256', code_challenge: challenge, state });
  window.location.href = 'https://accounts.spotify.com/authorize?' + p;
}
async function tokenReq(body: Record<string, string>) {
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: SP_CLIENT, ...body }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || 'Falha na autenticação do Spotify');
  const old = tokens();
  localStorage.setItem(SP_KEY, JSON.stringify({ access: j.access_token, refresh: j.refresh_token || old?.refresh, exp: Date.now() + j.expires_in * 1000 - 30000 }));
}
async function spGet(path: string) {
  let t = tokens();
  if (!t) throw new Error('Spotify desconectado');
  if (Date.now() > t.exp) { await tokenReq({ grant_type: 'refresh_token', refresh_token: t.refresh }); t = tokens(); }
  const r = await fetch('https://api.spotify.com/v1' + path, { headers: { Authorization: 'Bearer ' + t.access } });
  if (r.status === 429) throw new Error('Limite do Spotify atingido. Tente novamente em instantes.');
  if (r.status === 403) throw new Error('forbidden');
  if (!r.ok) throw new Error('Erro do Spotify (' + r.status + ')');
  return r.json();
}

type SpPl = { id: string; name: string; total: number; owner: string; collab: boolean; public: boolean | null; url: string };
type Pending = { id: string; playlist_id: string; position: number; title: string; artist: string; spotify_url: string | null; status: string };

async function ytMatch(q: string): Promise<Track[]> {
  const r = await fetch('/api/search?n=5&q=' + encodeURIComponent(q), { headers: await authHeader() });
  const j = await r.json();
  if (r.status === 429) throw new Error('quota');
  if (!r.ok) throw new Error(j.error || 'Erro na busca');
  return j.items as Track[];
}

export function SpotifyView({ go }: { go: (v: any) => void }) {
  const { userId, playlists, refresh } = useData();
  const [conn, setConn] = useState(false);
  const [lists, setLists] = useState<SpPl[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [pend, setPend] = useState<Pending[]>([]);
  const [manual, setManual] = useState<Pending | null>(null);
  const imported = playlists.filter((p) => p.source === 'spotify');

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from('import_pending').select('id,playlist_id,position,title,artist,spotify_url,status').in('status', ['pending', 'missing']).order('position');
    setPend((data as Pending[]) || []);
  }, []);

  const loadLists = useCallback(async () => {
    setMsg('Carregando playlists…');
    try {
      const out: SpPl[] = [];
      for (let off = 0; off < 200; off += 50) {
        const j = await spGet(`/me/playlists?limit=50&offset=${off}`);
        (j.items || []).forEach((p: any) => p && out.push({ id: p.id, name: p.name, total: p.items?.total ?? p.tracks?.total ?? 0, owner: p.owner?.display_name || '', collab: !!p.collaborative, public: p.public, url: p.external_urls?.spotify || '' }));
        if (!j.next) break;
      }
      setLists(out); setMsg(out.length ? '' : 'Nenhuma playlist encontrada.');
    } catch (e: any) { setMsg(e.message === 'forbidden' ? 'O Spotify negou o acesso. Seu usuário precisa estar autorizado no app (modo de desenvolvimento).' : e.message); }
  }, []);

  useEffect(() => {
    (async () => {
      const sp = new URLSearchParams(window.location.search);
      const code = sp.get('code');
      if (code && sp.get('state') === localStorage.getItem('dm-sp-s')) {
        try { await tokenReq({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), code_verifier: localStorage.getItem('dm-sp-v') || '' }); } catch (e: any) { setMsg(e.message); }
        window.history.replaceState({}, '', '/');
      }
      if (tokens()) { setConn(true); loadLists(); }
      loadPending();
    })();
  }, [loadLists, loadPending]);

  const matchPlaylist = async (pid?: string) => {
    setBusy(true);
    const { data } = await supabase.from('import_pending').select('id,playlist_id,position,title,artist,spotify_url,status').eq('status', 'pending').order('position');
    const rows = ((data as Pending[]) || []).filter((r) => !pid || r.playlist_id === pid);
    let i = 0;
    for (const r of rows) {
      setMsg(`Procurando no YouTube… ${++i}/${rows.length}`);
      try {
        const res = await ytMatch(`${r.artist} ${r.title}`);
        if (res[0]) {
          const t = res[0];
          await supabase.from('playlist_tracks').upsert({ playlist_id: r.playlist_id, user_id: userId, video_id: t.video_id, title: t.title, channel: t.channel, thumbnail: t.thumbnail, position: r.position }, { onConflict: 'playlist_id,video_id', ignoreDuplicates: true });
          await supabase.from('import_pending').update({ status: 'matched' }).eq('id', r.id);
        } else await supabase.from('import_pending').update({ status: 'missing' }).eq('id', r.id);
      } catch (e: any) {
        setMsg(e.message === 'quota' ? 'Cota diária do YouTube esgotada. As restantes continuam pendentes — retome amanhã.' : e.message);
        break;
      }
    }
    await refresh(); await loadPending(); setBusy(false);
    setMsg((m) => (m.startsWith('Procurando') ? 'Correspondência concluída.' : m));
  };

  const importSel = async () => {
    setBusy(true);
    try {
      for (const id of sel) {
        const l = lists.find((x) => x.id === id)!;
        setMsg(`Lendo “${l.name}”…`);
        const tracks: any[] = [];
        try {
          for (let off = 0; off < 1000; off += 50) {
            const j = await spGet(`/playlists/${id}/items?limit=50&offset=${off}`);
            (j.items || []).forEach((it: any) => { const t = it.item || (typeof it.track === 'object' ? it.track : null); if (t && t.type !== 'episode' && !t.is_local && t.name) tracks.push(t); });
            if (!j.next) break;
          }
        } catch (e: any) { setMsg(e.message === 'forbidden' ? `“${l.name}”: o Spotify não libera o conteúdo desta playlist para apps em modo de desenvolvimento (só as suas ou colaborativas).` : e.message); continue; }
        const { data: pl } = await supabase.from('playlists').insert({ user_id: userId, name: l.name, description: 'Importada do Spotify', source: 'spotify' }).select().single();
        if (!pl) continue;
        const rows = tracks.map((t, i) => ({ user_id: userId, playlist_id: pl.id, position: i, title: t.name, artist: (t.artists || []).map((a: any) => a.name).join(', '), album: t.album?.name || '', spotify_id: t.id, spotify_url: t.external_urls?.spotify || null }));
        for (let k = 0; k < rows.length; k += 100) await supabase.from('import_pending').insert(rows.slice(k, k + 100));
      }
      await refresh(); setSel(new Set());
      await matchPlaylist();
    } finally { setBusy(false); }
  };

  const disconnect = () => { ['dm-spotify', 'dm-sp-v', 'dm-sp-s'].forEach((k) => localStorage.removeItem(k)); setConn(false); setLists([]); setMsg('Spotify desconectado.'); };
  const wipe = async () => {
    if (!confirm('Excluir todas as playlists importadas do Spotify e os dados de importação?')) return;
    await supabase.from('playlists').delete().eq('source', 'spotify');
    await supabase.from('import_pending').delete().gte('created_at', '1970-01-01');
    await refresh(); await loadPending(); setMsg('Dados importados excluídos.');
  };

  return (
    <div className="animate-fadeIn">
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <h1 className="text-3xl font-extrabold mb-1">Importar do Spotify</h1>
      <p className="text-white/50 text-sm mb-4">Importamos só nomes, artistas, álbuns e ordem. As músicas tocam pelas fontes do Decola Music — nada de áudio do Spotify.</p>

      {!SP_CLIENT ? (
        <div className="bg-surface-2 rounded-xl p-4 text-sm text-white/70 space-y-2">
          <p className="font-semibold text-white">Spotify ainda não configurado</p>
          <p>1. Crie um app em developer.spotify.com/dashboard (a conta dona precisa ser Premium).</p>
          <p>2. Em Redirect URIs, adicione <span className="text-brand-orange break-all">{typeof window !== 'undefined' ? window.location.origin + '/' : ''}</span></p>
          <p>3. Em User Management, adicione os e-mails de quem vai usar (máx. 5).</p>
          <p>4. Na Vercel, defina <span className="text-brand-orange">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</span> com o Client ID e faça um novo deploy.</p>
        </div>
      ) : !conn ? (
        <button onClick={spLogin} className={btnAccent + ' w-full'}>Conectar Spotify</button>
      ) : (
        <>
          <div className="flex gap-3 mb-3">
            <button onClick={disconnect} className="px-4 py-2 rounded-full bg-surface-3 text-sm">Desconectar</button>
            <button onClick={wipe} className="px-4 py-2 rounded-full bg-surface-3 text-sm text-red-400">Excluir dados importados</button>
          </div>
          {lists.map((l) => (
            <label key={l.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer">
              <input type="checkbox" className="w-5 h-5 accent-orange-500" checked={sel.has(l.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n; })} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{l.name}</p>
                <p className="text-xs text-white/50">{l.total} músicas • {l.collab ? 'colaborativa' : l.public ? 'pública' : 'privada'}{l.owner ? ' • ' + l.owner : ''}</p>
              </div>
              {l.url && <a href={l.url} target="_blank" rel="noreferrer" className="text-xs text-white/50 underline" onClick={(e) => e.stopPropagation()}>Spotify</a>}
            </label>
          ))}
          {lists.length > 0 && <button disabled={!sel.size || busy} onClick={importSel} className={btnAccent + ' w-full mt-3 disabled:opacity-40'}>{busy ? 'Importando…' : `Importar selecionadas (${sel.size})`}</button>}
          <p className="text-xs text-white/40 mt-2">Cada música pesquisada consome 100 das 10.000 unidades diárias da cota do YouTube.</p>
        </>
      )}
      {msg && <p className="text-brand-orange text-sm mt-3">{msg}</p>}

      {pend.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-bold">Sem correspondência ({pend.filter((p) => p.status === 'missing').length}) • pendentes ({pend.filter((p) => p.status === 'pending').length})</h2>
            {pend.some((p) => p.status === 'pending') && <button disabled={busy} onClick={() => matchPlaylist()} className="text-sm text-brand-orange">Continuar</button>}
          </div>
          {pend.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/5">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{p.title}</p><p className="truncate text-xs text-white/50">{p.artist} • {p.status === 'missing' ? 'não encontrada' : 'pendente'}</p></div>
              {p.spotify_url && <a href={p.spotify_url} target="_blank" rel="noreferrer" className="text-xs text-white/40 underline">Spotify</a>}
              <button onClick={() => setManual(p)} className="text-sm text-brand-orange">Localizar</button>
            </div>
          ))}
        </div>
      )}
      {imported.length > 0 && <p className="text-xs text-white/40 mt-4">Playlists importadas: {imported.map((p) => p.name).join(', ')}</p>}
      {manual && <ManualMatch row={manual} userId={userId} onClose={() => setManual(null)} onDone={async () => { setManual(null); await refresh(); await loadPending(); }} />}
    </div>
  );
}

function ManualMatch({ row, userId, onClose, onDone }: { row: Pending; userId: string; onClose: () => void; onDone: () => void }) {
  const [q, setQ] = useState(`${row.artist} ${row.title}`);
  const [items, setItems] = useState<Track[]>([]);
  const [err, setErr] = useState('');
  const search = async () => { setErr(''); try { setItems(await ytMatch(q)); } catch (e: any) { setErr(e.message === 'quota' ? 'Cota do YouTube esgotada hoje.' : e.message); } };
  const pick = async (t: Track) => {
    await supabase.from('playlist_tracks').upsert({ playlist_id: row.playlist_id, user_id: userId, video_id: t.video_id, title: t.title, channel: t.channel, thumbnail: t.thumbnail, position: row.position }, { onConflict: 'playlist_id,video_id', ignoreDuplicates: true });
    await supabase.from('import_pending').update({ status: 'matched' }).eq('id', row.id);
    onDone();
  };
  return (
    <Modal title="Localizar música" onClose={onClose}>
      <div className="flex gap-2 mb-3"><input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} className={inputCls} /><button onClick={search} className={btnPrimary}><Icon n="search" /></button></div>
      {err && <p className="text-red-400 text-sm">{err}</p>}
      {items.map((t) => (
        <button key={t.video_id} onClick={() => pick(t)} className="flex items-center gap-3 w-full text-left py-2"><Cover src={t.thumbnail} size="w-12" className="rounded" /><div className="min-w-0"><p className="truncate text-sm font-semibold">{t.title}</p><p className="truncate text-xs text-white/50">{t.channel}</p></div></button>
      ))}
    </Modal>
  );
}
