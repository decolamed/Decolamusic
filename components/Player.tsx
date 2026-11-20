'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, Track } from '@/lib/supabase';
import { Icon, Cover } from './Ui';
import { useData } from './Data';

type PCtx = {
  current: Track | null;
  playing: boolean;
  full: boolean;
  setFull: (b: boolean) => void;
  play: (queue: Track[], index: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
};
const C = createContext<PCtx>(null as any);
export const usePlayer = () => useContext(C);

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { userId, favIds, toggleFav, openAdd } = useData();
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const player = useRef<any>(null);
  const stateRef = useRef({ queue, index });
  stateRef.current = { queue, index };
  const current = queue[index] || null;

  useEffect(() => {
    const w = window as any;
    if (w.YT && w.YT.Player) { setApiReady(true); return; }
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => { prev && prev(); setApiReady(true); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(s);
  }, []);

  const goNext = useCallback(() => {
    const { queue: q, index: i } = stateRef.current;
    if (i + 1 < q.length) setIndex(i + 1); else setPlaying(false);
  }, []);

  // create/load player when track changes
  useEffect(() => {
    if (!apiReady || !current) return;
    const w = window as any;
    if (!player.current) {
      player.current = new w.YT.Player('yt-player', {
        width: '100%', height: '100%', videoId: current.video_id,
        playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: (e: any) => e.target.playVideo(),
          onStateChange: (e: any) => {
            if (e.data === 1) setPlaying(true);
            else if (e.data === 2) setPlaying(false);
            else if (e.data === 0) goNext();
          },
          onError: () => goNext()
        }
      });
    } else {
      player.current.loadVideoById(current.video_id);
    }
    supabase.from('history').insert({ user_id: userId, video_id: current.video_id, title: current.title, channel: current.channel, thumbnail: current.thumbnail }).then(() => {});
    if ('mediaSession' in navigator) {
      (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({ title: current.title, artist: current.channel, artwork: [{ src: current.thumbnail }] });
    }
  }, [apiReady, current?.video_id]); // eslint-disable-line

  useEffect(() => {
    if (!current) return;
    const t = setInterval(() => {
      const p = player.current;
      if (p && p.getCurrentTime) { setPos(p.getCurrentTime() || 0); setDur(p.getDuration() || 0); }
    }, 500);
    return () => clearInterval(t);
  }, [!!current]);

  const play = (q: Track[], i: number) => { setQueue(q); setIndex(i); };
  const toggle = () => { const p = player.current; if (!p) return; playing ? p.pauseVideo() : p.playVideo(); };
  const next = () => { if (index + 1 < queue.length) setIndex(index + 1); };
  const prev = () => { if (pos > 4 && player.current) player.current.seekTo(0, true); else if (index > 0) setIndex(index - 1); };
  const seek = (v: number) => { player.current?.seekTo(v, true); setPos(v); };

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = (navigator as any).mediaSession;
    ms.setActionHandler('play', () => player.current?.playVideo());
    ms.setActionHandler('pause', () => player.current?.pauseVideo());
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('previoustrack', prev);
  });

  const fav = current ? favIds.has(current.video_id) : false;
  const hostCls = !current
    ? 'hidden'
    : full
    ? 'fixed z-[70] top-16 left-1/2 -translate-x-1/2 w-[min(92vw,760px)] aspect-video rounded-xl overflow-hidden shadow-2xl bg-black'
    : 'fixed z-[45] right-3 bottom-[150px] md:bottom-[92px] w-[200px] h-[113px] rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/15 bg-black animate-fadeIn';

  return (
    <C.Provider value={{ current, playing, full, setFull, play, toggle, next, prev }}>
      {children}
      <div className={hostCls}><div id="yt-player" /></div>

      {current && full && (
        <div className="fixed inset-0 z-[60] bg-gradient-to-b from-[#0c1a3d] via-black to-black animate-fadeIn flex flex-col px-5 pt-4 pb-8">
          <button onClick={() => setFull(false)} className="self-start text-white/80 p-1"><Icon n="down" s={30} /></button>
          <div className="mt-[min(62vw,470px)] md:mt-[min(46vw,470px)]">
            <h2 className="text-xl font-bold line-clamp-2">{current.title}</h2>
            <p className="text-white/60">{current.channel}</p>
          </div>
          <div className="mt-4">
            <input type="range" min={0} max={dur || 1} value={pos} onChange={(e) => seek(+e.target.value)} className="w-full" />
            <div className="flex justify-between text-xs text-white/50"><span>{fmt(pos)}</span><span>{fmt(dur)}</span></div>
          </div>
          <div className="flex items-center justify-center gap-7 mt-3">
            <button onClick={() => toggleFav(current)} className={fav ? 'text-brand-orange' : 'text-white/70'}><Icon n="heart" fill={fav} /></button>
            <button onClick={prev}><Icon n="prev" s={30} fill /></button>
            <button onClick={toggle} className="bg-brand-orange text-black rounded-full w-16 h-16 grid place-items-center active:scale-95 transition"><Icon n={playing ? 'pause' : 'play'} s={30} fill /></button>
            <button onClick={next}><Icon n="next" s={30} fill /></button>
            <button onClick={() => openAdd(current)} className="text-white/70"><Icon n="plus" /></button>
          </div>
          <div className="mt-auto overflow-y-auto no-scrollbar max-h-[22vh]">
            <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Fila</p>
            {queue.map((t, i) => (
              <button key={t.video_id + i} onClick={() => setIndex(i)} className={`flex items-center gap-3 w-full text-left py-1.5 ${i === index ? 'text-brand-orange' : 'text-white/80'}`}>
                <Cover src={t.thumbnail} size="w-9" className="rounded" /><span className="truncate text-sm">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {current && !full && (
        <div className="fixed z-40 left-0 right-0 bottom-14 md:bottom-0 glass border-t border-white/5 animate-slideUp">
          <input type="range" min={0} max={dur || 1} value={pos} onChange={(e) => seek(+e.target.value)} className="w-full h-1 block" />
          <div className="flex items-center gap-3 px-3 py-2 md:px-6 md:py-3">
            <button onClick={() => setFull(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <Cover src={current.thumbnail} size="w-11" className="rounded" />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{current.title}</p><p className="truncate text-xs text-white/50">{current.channel}</p></div>
            </button>
            <button onClick={() => toggleFav(current)} className={fav ? 'text-brand-orange' : 'text-white/60'}><Icon n="heart" fill={fav} s={20} /></button>
            <button onClick={() => setFull(true)} className="text-white/60" title="Ver videoclipe"><Icon n="video" s={20} /></button>
            <button onClick={prev} className="hidden sm:block"><Icon n="prev" fill /></button>
            <button onClick={toggle} className="bg-brand-orange text-black rounded-full w-10 h-10 grid place-items-center active:scale-95 transition"><Icon n={playing ? 'pause' : 'play'} fill s={20} /></button>
            <button onClick={next}><Icon n="next" fill /></button>
          </div>
        </div>
      )}
    </C.Provider>
  );
}
