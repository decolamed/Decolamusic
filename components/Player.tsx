'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, Track } from '@/lib/supabase';
import { Icon, Cover, Modal } from './Ui';
import { useData } from './Data';
import { useOffline, authHeader } from './Offline';
import { getFile } from '@/lib/offline';

type PCtx = { current: Track | null; playing: boolean; full: boolean; setFull: (b: boolean) => void; play: (queue: Track[], index: number) => void; toggle: () => void; next: () => void; prev: () => void };
const C = createContext<PCtx>(null as any);
export const usePlayer = () => useContext(C);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { userId, favIds, toggleFav, openMenu } = useData();
  const { local, toast } = useOffline();
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const [showQueue, setShowQueue] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objUrl = useRef('');
  const st = useRef({ queue, index, repeat });
  st.current = { queue, index, repeat };
  const current = queue[index] || null;

  const goNext = useCallback(() => {
    const { queue: q, index: i, repeat: r } = st.current;
    if (r === 'one' && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); }
    else if (i + 1 < q.length) setIndex(i + 1);
    else if (r === 'all' && q.length) setIndex(0);
    else setPlaying(false);
  }, []);

  const getAudio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('ended', goNext);
      a.addEventListener('play', () => setPlaying(true));
      a.addEventListener('pause', () => setPlaying(false));
      a.addEventListener('timeupdate', () => { setPos(a.currentTime || 0); setDur(isFinite(a.duration) ? a.duration : 0); });
      a.addEventListener('error', () => { if (a.getAttribute('src')) { toast('Não foi possível reproduzir esta faixa.'); goNext(); } });
      audioRef.current = a;
    }
    return audioRef.current;
  };

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    const key = current.video_id;
    (async () => {
      const a = getAudio();
      let src = '';
      if (local[key]) {
        const rec = await getFile(key).catch(() => undefined);
        if (rec) { if (objUrl.current) URL.revokeObjectURL(objUrl.current); objUrl.current = URL.createObjectURL(rec.blob); src = objUrl.current; }
      }
      if (!src) {
        if (!key.startsWith('jm:')) { toast('Faixa de uma fonte antiga (YouTube) não é mais suportada. Remova-a da playlist.'); goNext(); return; }
        if (!navigator.onLine) { toast('Sem internet: música não baixada.'); goNext(); return; }
        const j = await fetch('/api/jamendo/stream?id=' + key, { headers: await authHeader() }).then((r) => r.json()).catch(() => ({}));
        src = j.url || '';
      }
      if (cancelled) return;
      if (!src) { toast('Faixa indisponível.'); goNext(); return; }
      a.src = src; a.play().catch(() => {});
      if (navigator.onLine) supabase.from('history').insert({ user_id: userId, video_id: key, title: current.title, channel: current.channel, thumbnail: current.thumbnail }).then(() => {});
      if ('mediaSession' in navigator) (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({ title: current.title, artist: current.channel, artwork: current.thumbnail ? [{ src: current.thumbnail }] : [] });
    })();
    return () => { cancelled = true; };
  }, [current?.video_id]); // eslint-disable-line

  const play = (q: Track[], i: number) => {
    if (!navigator.onLine) {
      const ok = (t: Track) => !!local[t.video_id];
      const playable = q.filter(ok);
      if (!playable.length) { toast('Nenhuma destas músicas está baixada.'); return; }
      const skipped = q.length - playable.length;
      if (skipped) toast(`${skipped} música(s) indisponível(is) sem internet`);
      setQueue(playable); setIndex(ok(q[i]) ? playable.indexOf(q[i]) : 0); return;
    }
    setQueue(q); setIndex(i);
  };
  const toggle = () => { const a = audioRef.current; if (a) a.paused ? a.play() : a.pause(); };
  const next = () => { if (index + 1 < queue.length) setIndex(index + 1); else if (repeat === 'all') setIndex(0); };
  const prev = () => { if (pos > 4 && audioRef.current) audioRef.current.currentTime = 0; else if (index > 0) setIndex(index - 1); };
  const seek = (v: number) => { if (audioRef.current) audioRef.current.currentTime = v; setPos(v); };
  const toggleShuffle = () => {
    if (!shuffle && current) { const rest = queue.filter((_, i) => i !== index).sort(() => Math.random() - 0.5); setQueue([current, ...rest]); setIndex(0); }
    setShuffle(!shuffle);
  };

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = (navigator as any).mediaSession;
    ms.setActionHandler('play', () => audioRef.current?.play());
    ms.setActionHandler('pause', () => audioRef.current?.pause());
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('previoustrack', prev);
    try { ms.setActionHandler('seekto', (d: any) => seek(d.seekTime)); } catch {}
  });

  const fav = current ? favIds.has(current.video_id) : false;
  const pct = dur ? (pos / dur) * 100 : 0;
  const Slider = (
    <input type="range" min={0} max={dur || 1} step={0.5} value={pos} onChange={(e) => seek(+e.target.value)} className="w-full h-1 appearance-none rounded-full bg-white/20" style={{ background: `linear-gradient(to right,#ff7a1a ${pct}%,rgba(255,255,255,.2) ${pct}%)` }} />
  );

  return (
    <C.Provider value={{ current, playing, full, setFull, play, toggle, next, prev }}>
      {children}

      {current && full && (
        <div className="fixed inset-0 z-[60] bg-[radial-gradient(ellipse_at_top,#0c2a7a_0%,#05060a_55%)] animate-fadeIn flex flex-col px-6 pt-5 pb-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <button onClick={() => setFull(false)} className="p-1 text-white/90"><Icon n="down" s={30} /></button>
            <button onClick={() => openMenu(current)} className="p-1 text-white/90"><Icon n="dots" /></button>
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-center items-center min-h-0">
            <Cover src={current.thumbnail} size="w-[72vw] max-w-[360px]" className="rounded-2xl shadow-[0_20px_60px_rgba(30,107,255,.35)]" />
          </div>
          <div className="w-full max-w-[720px] mx-auto">
            <div className="flex items-center gap-3 mt-5">
              <div className="min-w-0 flex-1"><h2 className="text-2xl font-extrabold truncate">{current.title}</h2><p className="text-white/60 truncate">{current.channel}</p></div>
              <button onClick={() => toggleFav(current)} className={fav ? 'text-brand-orange' : 'text-white/60'}><Icon n="heart" s={28} fill={fav} /></button>
            </div>
            <div className="mt-4">{Slider}<div className="flex justify-between text-xs text-white/50 mt-1"><span>{fmt(pos)}</span><span>{fmt(dur)}</span></div></div>
            <div className="flex items-center justify-between mt-2 px-1">
              <button onClick={toggleShuffle} className={shuffle ? 'text-brand-orange' : 'text-white/80'}><Icon n="shuffle" /></button>
              <button onClick={prev}><Icon n="prev" s={30} fill /></button>
              <button onClick={toggle} className="bg-white text-black rounded-full w-[72px] h-[72px] grid place-items-center active:scale-95 transition"><Icon n={playing ? 'pause' : 'play'} s={32} fill /></button>
              <button onClick={next}><Icon n="next" s={30} fill /></button>
              <button onClick={() => setRepeat(repeat === 'off' ? 'all' : repeat === 'all' ? 'one' : 'off')} className={`relative ${repeat !== 'off' ? 'text-brand-orange' : 'text-white/80'}`}><Icon n="repeat" />{repeat === 'one' && <span className="absolute -top-1 -right-1 text-[10px] font-bold">1</span>}</button>
            </div>
            <div className="flex items-center justify-between mt-5">
              <span className="w-6" />
              <button onClick={() => setShowQueue(true)} className="text-white/80"><Icon n="queue" /></button>
            </div>
          </div>
        </div>
      )}

      {showQueue && (
        <Modal title="Fila" onClose={() => setShowQueue(false)}>
          {queue.map((t, i) => (
            <button key={t.video_id + i} onClick={() => { setIndex(i); setShowQueue(false); }} className={`flex items-center gap-3 w-full text-left py-2 ${i === index ? 'text-brand-orange' : ''}`}>
              <Cover src={t.thumbnail} size="w-10" className="rounded" /><span className="truncate text-sm">{t.title}</span>
            </button>
          ))}
        </Modal>
      )}

      {current && !full && (
        <div className="fixed z-40 left-2 right-2 bottom-[72px] md:left-[17rem] md:right-4 md:bottom-3 rounded-xl bg-surface-2/95 backdrop-blur border border-white/5 overflow-hidden animate-slideUp">
          <div className="flex items-center gap-3 p-2 pr-4">
            <button onClick={() => setFull(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <Cover src={current.thumbnail} size="w-11" className="rounded-lg" />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{current.title}</p><p className="truncate text-xs text-white/50">{current.channel}</p></div>
            </button>
            <button onClick={() => toggleFav(current)} className={fav ? 'text-brand-orange' : 'text-white/50'}><Icon n="heart" fill={fav} s={20} /></button>
            <button onClick={next} className="hidden sm:block"><Icon n="next" fill /></button>
            <button onClick={toggle}><Icon n={playing ? 'pause' : 'play'} fill s={26} /></button>
          </div>
          <div className="h-[3px] bg-white/10"><div className="h-full bg-brand-orange" style={{ width: pct + '%' }} /></div>
        </div>
      )}
    </C.Provider>
  );
}
