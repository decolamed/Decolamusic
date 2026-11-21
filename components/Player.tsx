'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, Track } from '@/lib/supabase';
import { Icon, Cover, Modal } from './Ui';
import { useData } from './Data';
import { useLocal } from './Local';
import { useRemote, Cmd } from './Remote';
import { getFile } from '@/lib/local';

type Repeat = 'off' | 'all' | 'one';
export type PView = { track: Track | null; playing: boolean; pos: number; dur: number; shuffle: boolean; repeat: Repeat; volume: number; queue: Track[]; index: number };
type PCtx = {
  current: Track | null; playing: boolean; full: boolean; setFull: (b: boolean) => void;
  play: (queue: Track[], index: number) => void; toggle: () => void; next: () => void; prev: () => void;
  seek: (v: number) => void; toggleShuffle: () => void; cycleRepeat: () => void; setVolume: (v: number) => void;
  transferTo: (id: string | null) => void; view: PView; target: string | null;
};
const C = createContext<PCtx>(null as any);
export const usePlayer = () => useContext(C);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { userId, favIds, toggleFav, openMenu } = useData();
  const { toast } = useLocal();
  const { target, remoteState, send, sendTo, setTarget, registerExec, publish, setTrackMeta, devices } = useRemote();
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [clip, setClip] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<Repeat>('off');
  const [volume, setVolumeState] = useState(100);
  const [showQueue, setShowQueue] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [rpos, setRpos] = useState(0);
  const [eng, setEng] = useState<'yt' | 'au'>('yt');
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const player = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const engine = useRef<'yt' | 'au'>('yt');
  const objUrl = useRef('');
  const slotRef = useRef<HTMLDivElement>(null);
  const startAt = useRef(0);
  const remoteStart = useRef(false);
  const posRef = useRef({ pos: 0, dur: 0, playing: false });
  const st = useRef({ queue, index, repeat });
  st.current = { queue, index, repeat };
  posRef.current.playing = playing;
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
    const { queue: q, index: i, repeat: r } = st.current;
    if (r === 'one') { if (engine.current === 'au' && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } else { player.current?.seekTo(0, true); player.current?.playVideo(); } }
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
      a.addEventListener('error', () => { if (a.getAttribute('src')) { toast('Não foi possível reproduzir este arquivo.'); goNext(); } });
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const applyVolume = (v: number) => { setVolumeState(v); if (audioRef.current) audioRef.current.volume = v / 100; try { player.current?.setVolume?.(v); } catch {} };

  useEffect(() => {
    if (!current) return;
    let cancelled = false;
    const key = current.video_id;
    (async () => {
      const sa = startAt.current; startAt.current = 0;
      if (key.startsWith('lc:')) {
        engine.current = 'au'; setEng('au');
        player.current?.pauseVideo?.();
        const rec = await getFile(key).catch(() => undefined);
        if (cancelled) return;
        if (!rec) { toast('Este arquivo está em outro aparelho.'); goNext(); return; }
        if (objUrl.current) URL.revokeObjectURL(objUrl.current);
        objUrl.current = URL.createObjectURL(rec.blob);
        const a = getAudio();
        a.volume = volume / 100;
        a.src = objUrl.current;
        if (sa > 1) a.addEventListener('loadedmetadata', () => { a.currentTime = sa; }, { once: true });
        a.play().catch(() => { if (remoteStart.current) setNeedsTap(true); });
      } else {
        if (!apiReady) { startAt.current = sa; return; }
        engine.current = 'yt'; setEng('yt');
        audioRef.current?.pause();
        const w = window as any;
        if (!player.current) {
          player.current = new w.YT.Player('yt-player', {
            width: '100%', height: '100%', videoId: key,
            playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, start: Math.floor(sa) },
            events: {
              onReady: (e: any) => { e.target.setVolume?.(volume); e.target.playVideo(); },
              onStateChange: (e: any) => { if (engine.current !== 'yt') return; if (e.data === 1) { setPlaying(true); setNeedsTap(false); } else if (e.data === 2) setPlaying(false); else if (e.data === 0) goNext(); },
              onError: () => goNext()
            }
          });
        } else player.current.loadVideoById({ videoId: key, startSeconds: sa });
        if (remoteStart.current) setTimeout(() => { if (!posRef.current.playing) setNeedsTap(true); }, 4000);
        supabase.from('history').insert({ user_id: userId, video_id: key, title: current.title, channel: current.channel, thumbnail: current.thumbnail }).then(() => {});
      }
      if ('mediaSession' in navigator) (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({ title: current.title, artist: current.channel, artwork: current.thumbnail ? [{ src: current.thumbnail }] : [] });
    })();
    return () => { cancelled = true; };
  }, [apiReady, current?.video_id]); // eslint-disable-line

  useEffect(() => {
    if (!current) return;
    const t = setInterval(() => {
      if (engine.current === 'au') { const a = audioRef.current; if (a) { setPos(a.currentTime || 0); setDur(isFinite(a.duration) ? a.duration : 0); posRef.current.pos = a.currentTime || 0; posRef.current.dur = isFinite(a.duration) ? a.duration : 0; } return; }
      const p = player.current; if (p && p.getCurrentTime) { const c = p.getCurrentTime() || 0, d = p.getDuration() || 0; setPos(c); setDur(d); posRef.current.pos = c; posRef.current.dur = d; }
    }, 500);
    return () => clearInterval(t);
  }, [!!current]);

  useEffect(() => {
    if (!full || !current || target) { setRect(null); return; }
    const upd = () => { const el = slotRef.current; if (el) { const r = el.getBoundingClientRect(); setRect({ top: r.top, left: r.left, width: r.width, height: r.height }); } };
    upd();
    const t = setInterval(upd, 200);
    window.addEventListener('resize', upd);
    return () => { clearInterval(t); window.removeEventListener('resize', upd); };
  }, [full, clip, !!current, target]);

  /* ---- operações locais ---- */
  const localPlay = (q: Track[], i: number, at = 0) => { startAt.current = at; setQueue(q); setIndex(i); };
  const localToggle = () => {
    if (engine.current === 'au') { const a = audioRef.current; if (a) a.paused ? a.play() : a.pause(); return; }
    const p = player.current; if (!p) return; playing ? p.pauseVideo() : p.playVideo();
  };
  const localPause = () => { audioRef.current?.pause(); try { player.current?.pauseVideo?.(); } catch {} };
  const localSeek = (v: number) => { if (engine.current === 'au' && audioRef.current) audioRef.current.currentTime = v; else player.current?.seekTo(v, true); setPos(v); };
  const localNext = () => { if (index + 1 < queue.length) setIndex(index + 1); else if (repeat === 'all') setIndex(0); };
  const localPrev = () => { if (pos > 4) localSeek(0); else if (index > 0) setIndex(index - 1); };
  const localShuffle = () => {
    if (!shuffle && current) { const rest = queue.filter((_, i) => i !== index).sort(() => Math.random() - 0.5); setQueue([current, ...rest]); setIndex(0); }
    setShuffle(!shuffle);
  };
  const nextRepeat = (r: Repeat): Repeat => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off');

  /* ---- receber comandos de outros aparelhos ---- */
  const exec = (c: Cmd) => {
    const v = c.v;
    switch (c.type) {
      case 'playQueue': remoteStart.current = true; localPlay(v.queue, v.index, v.pos || 0); break;
      case 'toggle': localToggle(); break;
      case 'play': if (!playing) localToggle(); break;
      case 'pause': if (playing) localToggle(); break;
      case 'next': localNext(); break;
      case 'prev': localPrev(); break;
      case 'seek': localSeek(v); break;
      case 'jump': setIndex(v); break;
      case 'shuffle': localShuffle(); break;
      case 'repeat': setRepeat(v); break;
      case 'volume': applyVolume(v); break;
      case 'sync': publish({ track: current, queue, index, playing, pos: posRef.current.pos, dur: posRef.current.dur, shuffle, repeat, volume }, true); break;
    }
  };
  registerExec(exec);

  /* ---- publicar estado deste aparelho ---- */
  useEffect(() => {
    setTrackMeta(current?.title || null, playing);
    if (target) return;
    publish({ track: current, queue, index, playing, pos: posRef.current.pos, dur: posRef.current.dur, shuffle, repeat, volume }, true);
  }, [current?.video_id, playing, shuffle, repeat, queue, volume, target]); // eslint-disable-line
  useEffect(() => {
    if (target || !current) return;
    const t = setInterval(() => publish({ pos: posRef.current.pos, dur: posRef.current.dur, playing: posRef.current.playing }, false), 1500);
    return () => clearInterval(t);
  }, [target, !!current]); // eslint-disable-line

  /* ---- visão (local ou remota) ---- */
  const R = target ? remoteState : null;
  useEffect(() => { setRpos(R?.pos || 0); }, [R?.pos, R?.track?.video_id]);
  useEffect(() => {
    if (!target || !R?.playing) return;
    const t = setInterval(() => setRpos((p) => p + 0.5), 500);
    return () => clearInterval(t);
  }, [target, R?.playing]);
  const view: PView = target
    ? { track: R?.track || null, playing: !!R?.playing, pos: rpos, dur: R?.dur || 0, shuffle: !!R?.shuffle, repeat: R?.repeat || 'off', volume: R?.volume ?? 100, queue: R?.queue || [], index: R?.index || 0 }
    : { track: current, playing, pos, dur, shuffle, repeat, volume, queue, index };
  const vt = view.track;
  const devName = devices.find((d) => d.id === target)?.name;

  /* ---- operações públicas ---- */
  const play = (q: Track[], i: number) => { if (target) { send('playQueue', { queue: q.slice(0, 100), index: i < 100 ? i : 0 }); toast(`Tocando em ${devName || 'outro aparelho'}`); } else { remoteStart.current = false; localPlay(q, i); } };
  const toggle = () => (target ? send('toggle') : localToggle());
  const next = () => (target ? send('next') : localNext());
  const prev = () => (target ? send('prev') : localPrev());
  const seek = (v: number) => { if (target) { send('seek', v); setRpos(v); } else localSeek(v); };
  const toggleShuffle = () => (target ? send('shuffle') : localShuffle());
  const cycleRepeat = () => (target ? send('repeat', nextRepeat(view.repeat)) : setRepeat(nextRepeat(repeat)));
  const setVolume = (v: number) => (target ? send('volume', v) : applyVolume(v));
  const jump = (i: number) => (target ? send('jump', i) : setIndex(i));
  const transferTo = (id: string | null) => {
    if (id) {
      if (current && !target) { sendTo(id, 'playQueue', { queue: queue.slice(0, 100), index: index < 100 ? index : 0, pos: posRef.current.pos }); localPause(); }
      setTarget(id);
    } else {
      const old = target, rs = remoteState;
      if (old) sendTo(old, 'pause');
      setTarget(null);
      if (rs?.track && rs.queue.length) { remoteStart.current = false; localPlay(rs.queue, rs.index, rs.pos); }
    }
  };

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const ms = (navigator as any).mediaSession;
    ms.setActionHandler('play', () => toggle());
    ms.setActionHandler('pause', () => toggle());
    ms.setActionHandler('nexttrack', next);
    ms.setActionHandler('previoustrack', prev);
    try { ms.setActionHandler('seekto', (d: any) => seek(d.seekTime)); } catch {}
  });

  const fav = vt ? favIds.has(vt.video_id) : false;
  const pct = view.dur ? (view.pos / view.dur) * 100 : 0;
  const hostFull = full && rect && eng === 'yt' && !target;
  const hostCls = !current || eng === 'au' || target ? 'hidden' : hostFull ? 'fixed z-[70] rounded-xl overflow-hidden bg-black shadow-2xl' : 'fixed z-[45] right-3 bottom-[152px] md:bottom-[96px] w-[200px] h-[113px] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/15 bg-black animate-fadeIn';
  const hostStyle = hostFull ? { top: rect!.top, left: rect!.left, width: rect!.width, height: rect!.height } : undefined;
  const goDevices = () => { setFull(false); window.dispatchEvent(new CustomEvent('dm-nav', { detail: 'devices' })); };
  const Slider = (
    <input type="range" min={0} max={view.dur || 1} step={0.5} value={Math.min(view.pos, view.dur || 1)} onChange={(e) => seek(+e.target.value)} className="w-full h-1 appearance-none rounded-full bg-white/20" style={{ background: `linear-gradient(to right,#ff7a1a ${pct}%,rgba(255,255,255,.2) ${pct}%)` }} />
  );

  return (
    <C.Provider value={{ current: vt, playing: view.playing, full, setFull, play, toggle, next, prev, seek, toggleShuffle, cycleRepeat, setVolume, transferTo, view, target }}>
      {children}
      <div className={hostCls} style={hostStyle}><div id="yt-player" /></div>

      {needsTap && !target && (
        <button onClick={() => { setNeedsTap(false); remoteStart.current = false; if (engine.current === 'au') audioRef.current?.play(); else player.current?.playVideo(); }} className="fixed inset-x-4 top-4 z-[95] bg-brand-orange text-black font-semibold rounded-2xl py-4 shadow-2xl animate-fadeIn">
          Toque aqui para iniciar a música enviada por outro aparelho
        </button>
      )}

      {vt && full && (
        <div className="fixed inset-0 z-[60] bg-[radial-gradient(ellipse_at_top,#0c2a7a_0%,#05060a_55%)] animate-fadeIn flex flex-col px-6 pt-5 pb-6 overflow-y-auto">
          <div className="flex items-center justify-between">
            <button onClick={() => setFull(false)} className="p-1 text-white/90"><Icon n="down" s={30} /></button>
            {target && <span className="text-xs text-brand-orange font-semibold">Tocando em {devName}</span>}
            <button onClick={() => openMenu(vt)} className="p-1 text-white/90"><Icon n="dots" /></button>
          </div>
          <div className="mt-4 flex-1 flex flex-col justify-center items-center min-h-0">
            {clip && eng === 'yt' && !target ? <div ref={slotRef} className="w-full max-w-[720px] aspect-video" /> : <Cover src={vt.thumbnail} size="w-[68vw] max-w-[340px]" className="rounded-2xl shadow-[0_20px_60px_rgba(30,107,255,.35)]" />}
          </div>
          <div className="w-full max-w-[720px] mx-auto">
            <div className="flex items-center gap-3 mt-5">
              <div className="min-w-0 flex-1"><h2 className="text-2xl font-extrabold truncate">{vt.title}</h2><p className="text-white/60 truncate">{vt.channel}</p></div>
              <button onClick={() => toggleFav(vt)} className={fav ? 'text-brand-orange' : 'text-white/60'}><Icon n="heart" s={28} fill={fav} /></button>
            </div>
            <div className="mt-4">{Slider}<div className="flex justify-between text-xs text-white/50 mt-1"><span>{fmt(view.pos)}</span><span>{fmt(view.dur)}</span></div></div>
            <div className="flex items-center justify-between mt-2 px-1">
              <button onClick={toggleShuffle} className={view.shuffle ? 'text-brand-orange' : 'text-white/80'}><Icon n="shuffle" /></button>
              <button onClick={prev}><Icon n="prev" s={30} fill /></button>
              <button onClick={toggle} className="bg-white text-black rounded-full w-[72px] h-[72px] grid place-items-center active:scale-95 transition"><Icon n={view.playing ? 'pause' : 'play'} s={32} fill /></button>
              <button onClick={next}><Icon n="next" s={30} fill /></button>
              <button onClick={cycleRepeat} className={`relative ${view.repeat !== 'off' ? 'text-brand-orange' : 'text-white/80'}`}><Icon n="repeat" />{view.repeat === 'one' && <span className="absolute -top-1 -right-1 text-[10px] font-bold">1</span>}</button>
            </div>
            <div className="flex items-center justify-between mt-5">
              <button onClick={goDevices} className={`flex items-center gap-2 text-sm ${target ? 'text-brand-orange' : 'text-white/80'}`}><Icon n="devices" />{target ? devName : 'Dispositivos'}</button>
              <button onClick={() => setShowQueue(true)} className="text-white/80"><Icon n="queue" /></button>
            </div>
            <div className="flex flex-col items-center gap-3 mt-3">
              {!clip && eng === 'yt' && !target && <div ref={slotRef} className="w-[200px] h-[113px]" />}
              {eng === 'yt' && !target && <button onClick={() => setClip(!clip)} className="w-full border-2 border-brand-orange text-brand-orange rounded-full py-3 font-semibold flex items-center justify-center gap-2 active:scale-[.98] transition">
                <Icon n={clip ? 'music' : 'play'} s={18} fill={!clip} />{clip ? 'Voltar à capa' : 'Assistir ao clipe'}
              </button>}
            </div>
          </div>
        </div>
      )}

      {showQueue && (
        <Modal title="Fila" onClose={() => setShowQueue(false)}>
          {view.queue.map((t, i) => (
            <button key={t.video_id + i} onClick={() => { jump(i); setShowQueue(false); }} className={`flex items-center gap-3 w-full text-left py-2 ${i === view.index ? 'text-brand-orange' : ''}`}>
              <Cover src={t.thumbnail} size="w-10" className="rounded" /><span className="truncate text-sm">{t.title}</span>
            </button>
          ))}
        </Modal>
      )}

      {vt && !full && (
        <div className="fixed z-40 left-2 right-2 bottom-[72px] md:left-[17rem] md:right-4 md:bottom-3 rounded-xl bg-surface-2/95 backdrop-blur border border-white/5 overflow-hidden animate-slideUp">
          <div className="flex items-center gap-3 p-2 pr-4">
            <button onClick={() => setFull(true)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
              <Cover src={vt.thumbnail} size="w-11" className="rounded-lg" />
              <div className="min-w-0"><p className="truncate text-sm font-semibold">{vt.title}</p><p className={`truncate text-xs ${target ? 'text-brand-orange' : 'text-white/50'}`}>{target ? `Tocando em ${devName}` : vt.channel}</p></div>
            </button>
            <button onClick={goDevices} className={target ? 'text-brand-orange' : 'text-white/50'}><Icon n="devices" s={20} /></button>
            <button onClick={() => toggleFav(vt)} className={fav ? 'text-brand-orange' : 'text-white/50'}><Icon n="heart" fill={fav} s={20} /></button>
            <button onClick={next} className="hidden sm:block"><Icon n="next" fill /></button>
            <button onClick={toggle}><Icon n={view.playing ? 'pause' : 'play'} fill s={26} /></button>
          </div>
          <div className="h-[3px] bg-white/10"><div className="h-full bg-brand-orange" style={{ width: pct + '%' }} /></div>
        </div>
      )}
    </C.Provider>
  );
}
