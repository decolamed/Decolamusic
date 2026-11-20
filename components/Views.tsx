'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { supabase, Track, Playlist } from '@/lib/supabase';
import { Icon, Cover, Modal, btnPrimary, btnAccent, inputCls } from './Ui';
import { useData } from './Data';
import { usePlayer } from './Player';

export type View = { name: 'home' | 'search' | 'library' | 'favorites' | 'history' | 'profile' } | { name: 'playlist'; id: string };
type Nav = (v: View) => void;

export function TrackRow({ t, queue, i, extra }: { t: Track; queue: Track[]; i: number; extra?: React.ReactNode }) {
  const { play, current, playing } = usePlayer();
  const { favIds, toggleFav, openAdd } = useData();
  const active = current?.video_id === t.video_id;
  const fav = favIds.has(t.video_id);
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition group">
      <button onClick={() => play(queue, i)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className="relative shrink-0">
          <Cover src={t.thumbnail} size="w-12" className="rounded" />
          {active && playing && <span className="absolute inset-0 bg-black/50 rounded grid place-items-center text-brand-orange"><Icon n="music" s={18} /></span>}
        </div>
        <div className="min-w-0">
          <p className={`truncate font-medium ${active ? 'text-brand-orange' : ''}`}>{t.title}</p>
          <p className="truncate text-sm text-white/50">{t.channel}</p>
        </div>
      </button>
      <button onClick={() => toggleFav(t)} className={fav ? 'text-brand-orange' : 'text-white/40 hover:text-white'}><Icon n="heart" s={20} fill={fav} /></button>
      <button onClick={() => openAdd(t)} className="text-white/40 hover:text-white"><Icon n="plus" s={20} /></button>
      {extra}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-8 animate-fadeIn"><h2 className="text-xl font-bold mb-3">{title}</h2>{children}</section>;
}

function PlaylistCard({ p, go }: { p: Playlist; go: Nav }) {
  return (
    <button onClick={() => go({ name: 'playlist', id: p.id })} className="bg-surface-2 hover:bg-surface-3 transition rounded-xl p-3 text-left active:scale-[.98]">
      <Cover src={p.cover} className="rounded-lg mb-2 shadow-lg" />
      <p className="font-semibold truncate">{p.name}</p>
      <p className="text-xs text-white/50">{p.count || 0} músicas</p>
    </button>
  );
}

export function Home({ go, name }: { go: Nav; name: string }) {
  const { playlists } = useData();
  const { play } = usePlayer();
  const [recent, setRecent] = useState<Track[]>([]);
  useEffect(() => {
    supabase.from('history').select('video_id,title,channel,thumbnail').order('played_at', { ascending: false }).limit(60).then(({ data }) => {
      const seen = new Set<string>();
      const out: Track[] = [];
      (data || []).forEach((r: any) => { if (!seen.has(r.video_id)) { seen.add(r.video_id); out.push(r); } });
      setRecent(out.slice(0, 12));
    });
  }, []);
  const h = new Date().getHours();
  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6 animate-fadeIn">{h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'}, <span className="text-brand-orange">{name}</span></h1>
      <Section title="Tocadas recentemente">
        {recent.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {recent.map((t, i) => (
              <button key={t.video_id} onClick={() => play(recent, i)} className="bg-surface-2 hover:bg-surface-3 transition rounded-xl p-3 text-left active:scale-[.98]">
                <Cover src={t.thumbnail} className="rounded-lg mb-2" />
                <p className="font-semibold text-sm line-clamp-2">{t.title}</p>
                <p className="text-xs text-white/50 truncate">{t.channel}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl p-6 text-center">
            <p className="text-white/60 mb-4">Você ainda não ouviu nada. Que tal começar?</p>
            <button onClick={() => go({ name: 'search' })} className={btnAccent}>Pesquisar músicas</button>
          </div>
        )}
      </Section>
      <Section title="Suas playlists">
        {playlists.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{playlists.map((p) => <PlaylistCard key={p.id} p={p} go={go} />)}</div>
        ) : <p className="text-white/50">Nenhuma playlist ainda. Crie a primeira na aba Biblioteca.</p>}
      </Section>
    </div>
  );
}

const CHIPS = ['Hits Brasil', 'Sertanejo', 'Pop', 'Rock', 'Funk', 'Pagode', 'Lo-fi', 'Gospel'];

export function Search() {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'musica' | 'clipe'>('musica');
  const [items, setItems] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const run = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true); setErr('');
    const { data } = await supabase.auth.getSession();
    const full = mode === 'clipe' ? `${term} videoclipe oficial` : `${term} música`;
    const r = await fetch('/api/search?q=' + encodeURIComponent(full), { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
    const j = await r.json();
    setLoading(false);
    if (!r.ok) { setErr(j.error || 'Erro na pesquisa'); return; }
    setItems(j.items);
  };
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex gap-2 mb-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Músicas, artistas ou videoclipes" className={inputCls} />
        <button className={btnPrimary} aria-label="Buscar"><Icon n="search" /></button>
      </form>
      <div className="flex gap-2 mb-4">
        {(['musica', 'clipe'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 rounded-full text-sm ${mode === m ? 'bg-brand-blue' : 'bg-surface-3 text-white/70'}`}>{m === 'musica' ? 'Músicas' : 'Videoclipes'}</button>
        ))}
      </div>
      {!items.length && !loading && (
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => <button key={c} onClick={() => { setQ(c); run(c); }} className="px-4 py-2 rounded-full bg-surface-2 hover:bg-surface-3 border border-white/10">{c}</button>)}
        </div>
      )}
      {loading && <p className="text-white/50 animate-pulse">Buscando…</p>}
      {err && <p className="text-red-400">{err}</p>}
      <div className="animate-fadeIn">{items.map((t, i) => <TrackRow key={t.video_id} t={t} queue={items} i={i} />)}</div>
    </div>
  );
}

export function Library({ go }: { go: Nav }) {
  const { playlists, favs, createPlaylist } = useData();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    const p = await createPlaylist(name.trim());
    setName(''); setOpen(false);
    if (p) go({ name: 'playlist', id: p.id });
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl font-extrabold">Sua biblioteca</h1>
        <button onClick={() => setOpen(true)} className={btnAccent + ' flex items-center gap-1'}><Icon n="plus" s={18} />Playlist</button>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={() => go({ name: 'favorites' })} className="rounded-xl p-4 text-left bg-gradient-to-br from-brand-blue to-[#0a2a80] active:scale-[.98] transition">
          <Icon n="heart" fill /><p className="font-bold mt-3">Favoritas</p><p className="text-sm text-white/70">{favs.length} músicas</p>
        </button>
        <button onClick={() => go({ name: 'history' })} className="rounded-xl p-4 text-left bg-surface-2 active:scale-[.98] transition">
          <Icon n="clock" /><p className="font-bold mt-3">Histórico</p><p className="text-sm text-white/50">Tocadas</p>
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">{playlists.map((p) => <PlaylistCard key={p.id} p={p} go={go} />)}</div>
      {open && (
        <Modal title="Nova playlist" onClose={() => setOpen(false)}>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Nome da playlist" className={inputCls} />
          <button onClick={create} className={btnAccent + ' w-full mt-4'}>Criar</button>
        </Modal>
      )}
    </div>
  );
}

export function PlaylistView({ id, go }: { id: string; go: Nav }) {
  const { playlists, refresh } = useData();
  const { play } = usePlayer();
  const pl = playlists.find((p) => p.id === id);
  const [tracks, setTracks] = useState<(Track & { id: string })[]>([]);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const load = useCallback(async () => {
    const { data } = await supabase.from('playlist_tracks').select('id,video_id,title,channel,thumbnail').eq('playlist_id', id).order('position');
    setTracks((data as any) || []);
  }, [id]);
  useEffect(() => { load(); }, [load, playlists]);
  useEffect(() => { if (pl) { setName(pl.name); setDesc(pl.description || ''); } }, [pl?.name, pl?.description]);
  if (!pl) return <p className="text-white/50">Playlist não encontrada.</p>;
  const save = async () => { await supabase.from('playlists').update({ name: name.trim() || pl.name, description: desc }).eq('id', id); await refresh(); setEditing(false); };
  const del = async () => { if (!confirm('Excluir esta playlist?')) return; await supabase.from('playlists').delete().eq('id', id); await refresh(); go({ name: 'library' }); };
  const remove = async (rid: string) => { await supabase.from('playlist_tracks').delete().eq('id', rid); await load(); await refresh(); };
  const shuffle = () => { const s = [...tracks].sort(() => Math.random() - 0.5); if (s.length) play(s, 0); };
  return (
    <div className="animate-fadeIn">
      <div className="flex gap-4 items-end mb-6">
        <Cover src={pl.cover} size="w-32 sm:w-44" className="rounded-xl shadow-2xl shrink-0" />
        <div className="min-w-0">
          <p className="text-xs uppercase text-white/50">Playlist</p>
          {editing ? (
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" className={inputCls} />
              <button onClick={save} className={btnPrimary}>Salvar</button>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold truncate">{pl.name}</h1>
              {pl.description && <p className="text-white/60 text-sm">{pl.description}</p>}
              <p className="text-white/40 text-sm">{tracks.length} músicas</p>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <button disabled={!tracks.length} onClick={() => play(tracks, 0)} className="bg-brand-orange text-black rounded-full w-14 h-14 grid place-items-center active:scale-95 transition disabled:opacity-40"><Icon n="play" fill s={26} /></button>
        <button disabled={!tracks.length} onClick={shuffle} className="text-white/70 disabled:opacity-40"><Icon n="shuffle" /></button>
        <button onClick={() => setEditing(!editing)} className="text-white/70"><Icon n="edit" /></button>
        <button onClick={del} className="text-white/70 hover:text-red-400"><Icon n="trash" /></button>
      </div>
      {tracks.length ? tracks.map((t, i) => (
        <TrackRow key={t.id} t={t} queue={tracks} i={i} extra={<button onClick={() => remove(t.id)} className="text-white/40 hover:text-red-400"><Icon n="x" s={18} /></button>} />
      )) : <p className="text-white/50">Playlist vazia. Use o botão + em qualquer música para adicionar.</p>}
    </div>
  );
}

export function Favorites() {
  const { favs } = useData();
  return (
    <div className="animate-fadeIn">
      <h1 className="text-3xl font-extrabold mb-4">Músicas favoritas</h1>
      {favs.length ? favs.map((t, i) => <TrackRow key={t.video_id} t={t} queue={favs} i={i} />) : <p className="text-white/50">Toque no coração de uma música para favoritar.</p>}
    </div>
  );
}

export function History() {
  const [items, setItems] = useState<Track[]>([]);
  useEffect(() => {
    supabase.from('history').select('video_id,title,channel,thumbnail').order('played_at', { ascending: false }).limit(100).then(({ data }) => setItems((data as Track[]) || []));
  }, []);
  const clear = async () => { if (!confirm('Limpar histórico?')) return; await supabase.from('history').delete().gte('played_at', '1970-01-01'); setItems([]); };
  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-extrabold">Histórico</h1>
        {items.length > 0 && <button onClick={clear} className="text-sm text-white/50 hover:text-red-400">Limpar</button>}
      </div>
      {items.length ? items.map((t, i) => <TrackRow key={t.video_id + i} t={t} queue={items} i={i} />) : <p className="text-white/50">Nada por aqui ainda.</p>}
    </div>
  );
}

export function Profile({ email, name, userId, onName }: { email: string; name: string; userId: string; onName: (n: string) => void }) {
  const [n, setN] = useState(name);
  const [saved, setSaved] = useState(false);
  const save = async () => { await supabase.from('profiles').update({ display_name: n }).eq('id', userId); onName(n); setSaved(true); setTimeout(() => setSaved(false), 1500); };
  return (
    <div className="max-w-md animate-fadeIn">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-blue to-brand-orange grid place-items-center text-4xl font-extrabold mb-4">{(n || email)[0]?.toUpperCase()}</div>
      <h1 className="text-3xl font-extrabold mb-1">Perfil</h1>
      <p className="text-white/50 mb-6">{email}</p>
      <label className="text-sm text-white/60">Nome</label>
      <input value={n} onChange={(e) => setN(e.target.value)} className={inputCls + ' mt-1 mb-3'} />
      <div className="flex gap-3">
        <button onClick={save} className={btnPrimary}>{saved ? 'Salvo ✓' : 'Salvar'}</button>
        <button onClick={() => supabase.auth.signOut()} className="px-5 py-2.5 rounded-full bg-surface-3 hover:bg-surface-2">Sair</button>
      </div>
    </div>
  );
}
