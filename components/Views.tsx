'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { supabase, Track, Playlist } from '@/lib/supabase';
import { Icon, Cover, Modal, btnPrimary, btnAccent, inputCls } from './Ui';
import { useData } from './Data';
import { usePlayer } from './Player';
import { useOffline } from './Offline';

export type View =
  | { name: 'home' | 'library' | 'favorites' | 'history' | 'profile' | 'downloads' }
  | { name: 'search'; q?: string }
  | { name: 'playlist'; id: string };
type Nav = (v: View) => void;

export function TrackRow({ t, queue, i, extra }: { t: Track; queue: Track[]; i: number; extra?: React.ReactNode }) {
  const { play, current, playing } = usePlayer();
  const { openMenu } = useData();
  const { local, online } = useOffline();
  const active = current?.video_id === t.video_id;
  const dl = !!local[t.video_id];
  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition ${!online && !dl ? 'opacity-40' : ''}`}>
      <button onClick={() => play(queue, i)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <div className="relative shrink-0">
          <Cover src={t.thumbnail} size="w-14" className="rounded-lg" />
          {active && playing && <span className="absolute inset-0 bg-black/50 rounded-lg grid place-items-center text-brand-orange"><Icon n="music" s={18} /></span>}
        </div>
        <div className="min-w-0">
          <p className={`truncate font-semibold ${active ? 'text-brand-orange' : ''}`}>{t.title}</p>
          <p className="truncate text-sm text-white/50">{dl && <span className="text-emerald-400">↓ </span>}{t.channel}{!online && !dl ? ' • indisponível offline' : ''}</p>
        </div>
      </button>
      {extra}
      <button onClick={() => openMenu(t)} className="text-white/60 p-1"><Icon n="dots" /></button>
    </div>
  );
}

function Head({ title, more }: { title: string; more?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-7">
      <h2 className="text-lg font-bold">{title}</h2>
      {more && <button onClick={more} className="text-xs text-white/50 flex items-center gap-1">Ver mais <Icon n="chev" s={12} /></button>}
    </div>
  );
}

const TILES = [
  { n: 'Trap BR', q: 'trap', g: 'from-blue-700 to-indigo-950' },
  { n: 'Indie Hits', q: 'indie', g: 'from-pink-600 to-rose-950' },
  { n: 'Brasil Hits', q: 'brasil', g: 'from-amber-500 to-orange-900' },
  { n: 'Sertanejo', q: 'sertanejo', g: 'from-emerald-600 to-teal-950' },
  { n: 'Funk', q: 'funk', g: 'from-fuchsia-600 to-purple-950' },
  { n: 'Pop', q: 'pop', g: 'from-sky-500 to-blue-950' },
  { n: 'Rock', q: 'rock', g: 'from-red-600 to-red-950' },
  { n: 'Lo-fi', q: 'lofi', g: 'from-violet-600 to-slate-900' }
];

export function Home({ go, name }: { go: Nav; name: string }) {
  const { playlists, favs } = useData();
  const { play } = usePlayer();
  const [recent, setRecent] = useState<Track[]>([]);
  useEffect(() => {
    supabase.from('history').select('video_id,title,channel,thumbnail').order('played_at', { ascending: false }).limit(60).then(({ data }) => {
      const seen = new Set<string>(); const out: Track[] = [];
      (data || []).forEach((r: any) => { if (!seen.has(r.video_id)) { seen.add(r.video_id); out.push(r); } });
      setRecent(out.slice(0, 12));
    });
  }, []);
  return (
    <div className="animate-fadeIn">
      <div className="flex items-start justify-between">
        <div><h1 className="text-3xl font-extrabold">Olá, {name}!</h1><p className="text-white/60">Bora ouvir algo hoje?</p></div>
        <div className="flex items-center gap-4 mt-1">
          <Icon n="bell" className="text-white/80" />
          <button onClick={() => go({ name: 'profile' })} className="w-9 h-9 rounded-full bg-brand-blue grid place-items-center font-bold">{name[0]?.toUpperCase()}</button>
        </div>
      </div>
      <button onClick={() => go({ name: 'search' })} className="mt-5 w-full flex items-center gap-3 bg-surface-3 rounded-full px-5 py-3.5 text-white/50 text-left"><Icon n="search" s={20} />Buscar músicas, artistas...</button>
      <div className="mt-5 relative overflow-hidden rounded-2xl p-5 h-36 bg-gradient-to-br from-[#0b2f9e] via-[#0a1a4d] to-[#05060a]">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-brand-orange/70 blur-2xl" />
        <p className="relative text-2xl font-extrabold leading-tight">Descubra<br />novos sons</p>
        <p className="relative text-xs text-white/70 mt-1 max-w-[60%]">Explore playlists feitas para você</p>
        <button onClick={() => go({ name: 'search', q: 'brasil' })} className="absolute right-4 bottom-4 w-12 h-12 rounded-full bg-brand-orange text-black grid place-items-center active:scale-95 transition"><Icon n="play" fill s={22} /></button>
      </div>
      {recent.length > 0 && (<>
        <Head title="Tocadas recentemente" more={() => go({ name: 'history' })} />
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          {recent.map((t, i) => (
            <button key={t.video_id} onClick={() => play(recent, i)} className="w-32 shrink-0 text-left active:scale-[.97] transition">
              <Cover src={t.thumbnail} className="rounded-xl mb-2" />
              <p className="text-sm font-semibold truncate">{t.title}</p><p className="text-xs text-white/50 truncate">{t.channel}</p>
            </button>
          ))}
        </div>
      </>)}
      <Head title="Recomendado para você" />
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {TILES.map((t) => (
          <button key={t.n} onClick={() => go({ name: 'search', q: t.q })} className="w-32 shrink-0 text-left active:scale-[.97] transition">
            <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${t.g} p-3 flex items-end font-extrabold text-lg leading-tight`}>{t.n}</div>
            <p className="text-sm font-semibold mt-2">{t.n}</p><p className="text-xs text-white/50">Playlist</p>
          </button>
        ))}
      </div>
      <Head title="Suas playlists" more={() => go({ name: 'library' })} />
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        <button onClick={() => go({ name: 'library' })} className="w-32 shrink-0 text-left">
          <div className="w-full aspect-square rounded-xl bg-surface-3 grid place-items-center"><Icon n="plus" s={30} /></div><p className="text-sm font-semibold mt-2">Criar playlist</p>
        </button>
        <button onClick={() => go({ name: 'favorites' })} className="w-32 shrink-0 text-left">
          <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-indigo-600 to-purple-900 grid place-items-center"><Icon n="heart" s={34} fill /></div>
          <p className="text-sm font-semibold mt-2">Favoritas</p><p className="text-xs text-white/50">{favs.length} músicas</p>
        </button>
        {playlists.map((p) => (
          <button key={p.id} onClick={() => go({ name: 'playlist', id: p.id })} className="w-32 shrink-0 text-left">
            <Cover src={p.cover} className="rounded-xl" /><p className="text-sm font-semibold mt-2 truncate">{p.name}</p><p className="text-xs text-white/50">{p.count} músicas</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export function Search({ initial }: { initial?: string }) {
  const [q, setQ] = useState(initial || '');
  const [items, setItems] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const run = async (term: string) => {
    if (!term.trim()) return;
    setLoading(true); setErr('');
    const { data } = await supabase.auth.getSession();
    try {
      const r = await fetch('/api/jamendo/search?q=' + encodeURIComponent(term), { headers: { Authorization: `Bearer ${data.session?.access_token}` } });
      const j = await r.json();
      if (!r.ok) setErr(j.error || 'Erro na pesquisa'); else { setItems(j.items); if (!j.items.length) setErr('Nada encontrado.'); }
    } catch { setErr('Sem conexão. Tente novamente.'); }
    setLoading(false);
  };
  useEffect(() => { if (initial) run(initial); }, []); // eslint-disable-line
  return (
    <div className="animate-fadeIn">
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex items-center gap-3 bg-surface-3 rounded-full px-5 py-3.5">
        <Icon n="search" s={20} className="text-white/60" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no Decola Music..." className="flex-1 bg-transparent outline-none placeholder:text-white/40" />
      </form>
      <p className="text-xs text-white/40 mt-3 mb-4">Música independente com licença aberta (Jamendo). Toca com a tela apagada.</p>
      {!items.length && !loading && !err && (
        <div className="grid grid-cols-2 gap-3">
          {TILES.map((t) => <button key={t.n} onClick={() => { setQ(t.q); run(t.q); }} className={`rounded-xl p-4 h-20 text-left font-bold bg-gradient-to-br ${t.g}`}>{t.n}</button>)}
        </div>
      )}
      {items.length > 0 && <h2 className="font-bold mb-2">Resultados</h2>}
      {loading && <p className="text-white/50 animate-pulse">Buscando…</p>}
      {err && <p className="text-brand-orange">{err}</p>}
      {items.map((t, i) => <TrackRow key={t.video_id} t={t} queue={items} i={i} />)}
    </div>
  );
}

export function Library({ go }: { go: Nav }) {
  const { playlists, favs, createPlaylist } = useData();
  const [name, setName] = useState('');
  const [open, setOpen] = useState(false);
  const [hist, setHist] = useState<Track[]>([]);
  useEffect(() => {
    supabase.from('history').select('video_id,title,channel,thumbnail').order('played_at', { ascending: false }).limit(3).then(({ data }) => setHist((data as Track[]) || []));
  }, []);
  const create = async () => {
    if (!name.trim()) return;
    const p = await createPlaylist(name.trim());
    setName(''); setOpen(false);
    if (p) go({ name: 'playlist', id: p.id });
  };
  const Row = ({ onClick, cover, title, sub, children }: any) => (
    <button onClick={onClick} className="flex items-center gap-4 w-full text-left p-2 rounded-xl hover:bg-white/5 active:scale-[.99] transition">
      {children || <Cover src={cover} size="w-14" className="rounded-lg" />}
      <div><p className="font-semibold">{title}</p>{sub && <p className="text-sm text-white/50">{sub}</p>}</div>
    </button>
  );
  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-extrabold">Sua Biblioteca</h1>
        <div className="flex gap-4"><button onClick={() => go({ name: 'search' })}><Icon n="search" /></button><button onClick={() => setOpen(true)}><Icon n="plus" /></button></div>
      </div>
      <div className="flex gap-2 mb-4">
        <span className="px-5 py-1.5 rounded-full text-sm font-semibold bg-brand-orange text-black">Playlists</span>
        <button onClick={() => go({ name: 'favorites' })} className="px-5 py-1.5 rounded-full text-sm bg-surface-3 text-white/80">Favoritas</button>
        <button onClick={() => go({ name: 'downloads' })} className="px-5 py-1.5 rounded-full text-sm bg-surface-3 text-white/80">Downloads</button>
        <button onClick={() => go({ name: 'history' })} className="px-5 py-1.5 rounded-full text-sm bg-surface-3 text-white/80">Histórico</button>
      </div>
      <Row onClick={() => go({ name: 'favorites' })} title="Favoritas" sub={`${favs.length} músicas`}>
        <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-700 grid place-items-center"><Icon n="heart" fill /></div>
      </Row>
      {playlists.map((p) => <Row key={p.id} onClick={() => go({ name: 'playlist', id: p.id })} cover={p.cover} title={p.name} sub={`${p.count} músicas`} />)}
      <Row onClick={() => go({ name: 'downloads' })} title="Downloads" sub="Músicas offline neste dispositivo"><div className="w-14 h-14 rounded-lg bg-surface-3 grid place-items-center"><Icon n="down" /></div></Row>
      <Row onClick={() => setOpen(true)} title="Criar playlist"><div className="w-14 h-14 rounded-lg bg-surface-3 grid place-items-center"><Icon n="plus" /></div></Row>
      {hist.length > 0 && (<>
        <Head title="Histórico" more={() => go({ name: 'history' })} />
        {hist.map((t, i) => <TrackRow key={t.video_id + i} t={t} queue={hist} i={i} />)}
      </>)}
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
    const { data, error } = await supabase.from('playlist_tracks').select('id,video_id,title,channel,thumbnail').eq('playlist_id', id).order('position');
    if (!error && data) { setTracks(data as any); try { localStorage.setItem('dm-pt-' + id, JSON.stringify(data)); } catch {} }
    else { try { setTracks(JSON.parse(localStorage.getItem('dm-pt-' + id) || '[]')); } catch {} }
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
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <div className="flex justify-center"><Cover src={pl.cover} size="w-56" className="rounded-2xl shadow-2xl" /></div>
      <div className="flex items-end justify-between mt-5 gap-3">
        <div className="min-w-0">
          {editing ? (
            <div className="space-y-2"><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" className={inputCls} /><button onClick={save} className={btnPrimary}>Salvar</button></div>
          ) : (<>
            <h1 className="text-3xl font-extrabold truncate">{pl.name}</h1>
            <p className="text-white/50 text-sm">{tracks.length} músicas • por você</p>
            {pl.description && <p className="text-white/60 text-sm mt-1">{pl.description}</p>}
          </>)}
        </div>
        <button disabled={!tracks.length} onClick={() => play(tracks, 0)} className="shrink-0 bg-brand-orange text-black rounded-full w-14 h-14 grid place-items-center active:scale-95 transition disabled:opacity-40"><Icon n="play" fill s={26} /></button>
      </div>
      <div className="flex items-center gap-6 my-4 text-white/80">
        <button disabled={!tracks.length} onClick={shuffle} className="disabled:opacity-40"><Icon n="shuffle" /></button>
        <button onClick={() => setEditing(!editing)}><Icon n="edit" /></button>
        <button onClick={del} className="hover:text-red-400"><Icon n="trash" /></button>
      </div>
      {tracks.length ? tracks.map((t, i) => (
        <TrackRow key={t.id} t={t} queue={tracks} i={i} extra={<button onClick={() => remove(t.id)} className="text-white/40 hover:text-red-400"><Icon n="x" s={18} /></button>} />
      )) : <p className="text-white/50">Playlist vazia. Use o menu ⋮ de qualquer música para adicionar.</p>}
    </div>
  );
}

export function Favorites({ go }: { go: Nav }) {
  const { favs } = useData();
  const { play } = usePlayer();
  return (
    <div className="animate-fadeIn">
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <div className="flex items-center justify-between mb-4">
        <div><h1 className="text-3xl font-extrabold">Favoritas</h1><p className="text-white/50 text-sm">{favs.length} músicas</p></div>
        <button disabled={!favs.length} onClick={() => play(favs, 0)} className="bg-brand-orange text-black rounded-full w-14 h-14 grid place-items-center disabled:opacity-40"><Icon n="play" fill s={26} /></button>
      </div>
      {favs.length ? favs.map((t, i) => <TrackRow key={t.video_id} t={t} queue={favs} i={i} />) : <p className="text-white/50">Abra o menu ⋮ de uma música para favoritar.</p>}
    </div>
  );
}

export function History({ go }: { go: Nav }) {
  const [items, setItems] = useState<Track[]>([]);
  useEffect(() => {
    supabase.from('history').select('video_id,title,channel,thumbnail').order('played_at', { ascending: false }).limit(100).then(({ data }) => setItems((data as Track[]) || []));
  }, []);
  const clear = async () => { if (!confirm('Limpar histórico?')) return; await supabase.from('history').delete().gte('played_at', '1970-01-01'); setItems([]); };
  return (
    <div className="animate-fadeIn">
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-extrabold">Histórico</h1>
        {items.length > 0 && <button onClick={clear} className="text-sm text-white/50 hover:text-red-400">Limpar</button>}
      </div>
      {items.length ? items.map((t, i) => <TrackRow key={t.video_id + i} t={t} queue={items} i={i} />) : <p className="text-white/50">Nada por aqui ainda.</p>}
    </div>
  );
}

export function Profile({ email, name, userId, onName, go }: { email: string; name: string; userId: string; onName: (n: string) => void; go: Nav }) {
  const [editing, setEditing] = useState(false);
  const [n, setN] = useState(name);
  const [about, setAbout] = useState(false);
  const save = async () => { await supabase.from('profiles').update({ display_name: n }).eq('id', userId); onName(n); setEditing(false); };
  return (
    <div className="animate-fadeIn">
      <div className="flex items-center gap-4 mt-4 pb-6 border-b border-white/10">
        <div className="w-20 h-20 rounded-full bg-brand-blue grid place-items-center text-4xl font-bold shrink-0">{(name || email)[0]?.toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          {editing ? <div className="flex gap-2"><input value={n} onChange={(e) => setN(e.target.value)} className={inputCls} /><button onClick={save} className={btnPrimary}>OK</button></div>
            : <><p className="text-xl font-bold truncate">{name}</p><p className="text-white/50 text-sm truncate">{email}</p></>}
        </div>
        {!editing && <button onClick={() => { setN(name); setEditing(true); }} className="text-white/70"><Icon n="edit" /></button>}
      </div>
      <button onClick={() => go({ name: 'downloads' })} className="flex items-center gap-4 w-full py-5 text-left"><Icon n="down" className="text-white/70" /><span className="flex-1">Downloads</span><Icon n="chev" s={18} className="text-white/50" /></button>
      <button onClick={() => setAbout(true)} className="flex items-center gap-4 w-full py-5 text-left"><Icon n="info" className="text-white/70" /><span className="flex-1">Sobre o Decola Music</span><Icon n="chev" s={18} className="text-white/50" /></button>
      <button onClick={() => supabase.auth.signOut()} className="w-full py-3.5 rounded-full bg-surface-3 font-semibold mt-2">Sair</button>
      {about && <Modal title="Decola Music" onClose={() => setAbout(false)}><p className="text-white/70 text-sm">Seu player pessoal: música livre do Jamendo, playlists e favoritos salvos na sua conta.</p></Modal>}
    </div>
  );
}
