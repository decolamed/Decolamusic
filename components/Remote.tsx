'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, Track } from '@/lib/supabase';
import { useData } from './Data';
import { useLocal } from './Local';

export type Dev = { id: string; name: string; kind: string; track: string | null; playing: boolean };
export type RState = { track: Track | null; queue: Track[]; index: number; playing: boolean; pos: number; dur: number; shuffle: boolean; repeat: 'off' | 'all' | 'one'; volume: number };
export type Cmd = { to: string; type: string; v?: any };

type Ctx = {
  me: Dev;
  devices: Dev[];
  target: string | null;
  setTarget: (id: string | null) => void;
  remoteState: RState | null;
  send: (type: string, v?: any) => void;
  sendTo: (id: string, type: string, v?: any) => void;
  rename: (n: string) => void;
  registerExec: (fn: (c: Cmd) => void) => void;
  publish: (state: Partial<RState>, full: boolean) => void;
  setTrackMeta: (track: string | null, playing: boolean) => void;
  online: boolean;
};
const C = createContext<Ctx>(null as any);
export const useRemote = () => useContext(C);

function deviceInfo() {
  const ua = navigator.userAgent;
  const tablet = /iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua));
  const phone = /Mobile|iPhone/i.test(ua);
  return tablet ? { kind: 'tablet', def: 'Tablet' } : phone ? { kind: 'celular', def: 'Celular' } : { kind: 'computador', def: 'Computador' };
}

export function RemoteProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useData();
  const { toast } = useLocal();
  const info = useRef(deviceInfo()).current;
  const idRef = useRef('');
  if (!idRef.current && typeof window !== 'undefined') {
    let id = localStorage.getItem('dm-device-id');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('dm-device-id', id); }
    idRef.current = id;
  }
  const [name, setName] = useState(() => (typeof window !== 'undefined' && localStorage.getItem('dm-device-name')) || info.def);
  const [devices, setDevices] = useState<Dev[]>([]);
  const [target, setTargetState] = useState<string | null>(null);
  const [remoteState, setRemoteState] = useState<RState | null>(null);
  const [online, setOnline] = useState(false);
  const chRef = useRef<any>(null);
  const execRef = useRef<(c: Cmd) => void>(() => {});
  const targetRef = useRef<string | null>(null);
  targetRef.current = target;
  const devicesRef = useRef<Dev[]>([]);
  devicesRef.current = devices;
  const meta = useRef({ track: null as string | null, playing: false });
  const nameRef = useRef(name);
  nameRef.current = name;

  const myDev = (): Dev => ({ id: idRef.current, name: nameRef.current, kind: info.kind, track: meta.current.track, playing: meta.current.playing });
  const pushPresence = useCallback(() => { const ch = chRef.current; if (ch && ch.__ready) ch.track(myDev()).catch(() => {}); }, []); // eslint-disable-line

  useEffect(() => {
    let closed = false;
    let triedPublic = false;
    const topic = 'remote:' + userId;
    const connect = (priv: boolean) => {
      const ch: any = supabase.channel(topic, { config: { private: priv, broadcast: { self: false }, presence: { key: idRef.current } } });
      ch.on('presence', { event: 'sync' }, () => {
        const list: Dev[] = [];
        Object.values(ch.presenceState()).forEach((arr: any) => { const m = arr[arr.length - 1]; if (m) list.push(m as Dev); });
        setDevices(list);
      })
        .on('broadcast', { event: 'cmd' }, ({ payload }: any) => { if (payload?.to === idRef.current) execRef.current(payload); })
        .on('broadcast', { event: 'state' }, ({ payload }: any) => {
          if (payload?.from !== targetRef.current) return;
          setRemoteState((prev) => (payload.full ? payload.state : { ...(prev || ({} as RState)), ...payload.state }));
        })
        .subscribe((status: string) => {
          if (closed) return;
          if (status === 'SUBSCRIBED') { ch.__ready = true; setOnline(true); ch.track(myDev()).catch(() => {}); }
          else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && priv && !triedPublic) { triedPublic = true; supabase.removeChannel(ch); connect(false); }
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setOnline(false);
        });
      chRef.current = ch;
    };
    connect(true);
    return () => { closed = true; if (chRef.current) supabase.removeChannel(chRef.current); chRef.current = null; setOnline(false); };
  }, [userId]); // eslint-disable-line

  useEffect(() => { pushPresence(); }, [name, pushPresence]);

  // alvo saiu da conta
  useEffect(() => {
    if (target && online && !devices.find((d) => d.id === target)) { setTargetState(null); setRemoteState(null); toast('O aparelho controlado saiu da conta.'); }
  }, [devices]); // eslint-disable-line

  const sendTo = useCallback((id: string, type: string, v?: any) => { chRef.current?.send({ type: 'broadcast', event: 'cmd', payload: { to: id, type, v } }); }, []);
  const send = useCallback((type: string, v?: any) => { if (targetRef.current) sendTo(targetRef.current, type, v); }, [sendTo]);
  const setTarget = useCallback((id: string | null) => {
    setTargetState(id); targetRef.current = id; setRemoteState(null);
    if (id) sendTo(id, 'sync');
  }, [sendTo]);
  const publish = useCallback((state: Partial<RState>, full: boolean) => {
    if (devicesRef.current.length < 2) return;
    chRef.current?.send({ type: 'broadcast', event: 'state', payload: { from: idRef.current, full, state } });
  }, []);
  const setTrackMeta = useCallback((track: string | null, playing: boolean) => {
    if (meta.current.track === track && meta.current.playing === playing) return;
    meta.current = { track, playing }; pushPresence();
  }, [pushPresence]);
  const rename = (n: string) => { const v = n.trim().slice(0, 30) || info.def; localStorage.setItem('dm-device-name', v); setName(v); };
  const registerExec = useCallback((fn: (c: Cmd) => void) => { execRef.current = fn; }, []);

  return (
    <C.Provider value={{ me: { id: idRef.current, name, kind: info.kind, track: meta.current.track, playing: meta.current.playing }, devices, target, setTarget, remoteState, send, sendTo, rename, registerExec, publish, setTrackMeta, online }}>
      {children}
    </C.Provider>
  );
}

/* ---------------- Tela "Dispositivos" ---------------- */
import { Icon, Cover, btnAccent } from './Ui';
import { usePlayer } from './Player';

const fmtT = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function DevicesView({ go }: { go: (v: any) => void }) {
  const { me, devices, target, rename, online } = useRemote();
  const { view, transferTo, toggle, next, prev, seek, toggleShuffle, cycleRepeat, setVolume } = usePlayer();
  const others = devices.filter((d) => d.id !== me.id);
  const t = view.track;
  const kindIcon = (k: string) => (k === 'celular' ? '📱' : k === 'tablet' ? '📲' : '🖥️');
  return (
    <div className="animate-fadeIn">
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <h1 className="text-3xl font-extrabold">Dispositivos</h1>
      <p className="text-white/50 text-sm mb-4">Entre na mesma conta em outro aparelho e controle a música daqui. O aparelho que toca precisa estar com o app aberto e a tela ligada.</p>
      {!online && <p className="text-brand-orange text-sm mb-3">Conectando ao serviço de controle remoto…</p>}

      <div className={`rounded-xl p-4 mb-3 border ${!target ? 'border-brand-orange bg-brand-orange/10' : 'border-white/10 bg-surface-2'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">{kindIcon(me.kind)}</span>
          <div className="flex-1 min-w-0"><p className="font-semibold truncate">{me.name} <span className="text-xs text-white/50">(este aparelho)</span></p>
            <p className="text-xs text-white/50 truncate">{!target ? (view.track ? (view.playing ? 'Tocando: ' : 'Pausado: ') + view.track.title : 'Pronto para tocar') : 'Inativo'}</p></div>
          <button onClick={() => { const n = prompt('Nome deste aparelho', me.name); if (n !== null) rename(n); }} className="text-white/50"><Icon n="edit" s={18} /></button>
        </div>
        {target && <button onClick={() => transferTo(null)} className={btnAccent + ' w-full mt-3'}>Tocar neste aparelho</button>}
      </div>

      {others.map((d) => (
        <div key={d.id} className={`rounded-xl p-4 mb-3 border ${target === d.id ? 'border-brand-orange bg-brand-orange/10' : 'border-white/10 bg-surface-2'}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{kindIcon(d.kind)}</span>
            <div className="flex-1 min-w-0"><p className="font-semibold truncate">{d.name}</p><p className="text-xs text-white/50 truncate">{d.track ? (d.playing ? 'Tocando: ' : 'Pausado: ') + d.track : 'Disponível'}</p></div>
            {target === d.id ? <span className="text-xs text-brand-orange font-semibold">Controlando</span> : <button onClick={() => transferTo(d.id)} className="text-sm font-semibold text-brand-orange">{view.track && !target ? 'Tocar aqui' : 'Controlar'}</button>}
          </div>
        </div>
      ))}
      {!others.length && online && <p className="text-white/50 text-sm">Nenhum outro aparelho conectado. Abra o Decola Music em outro aparelho, entre com a mesma conta e ele aparece aqui.</p>}

      {target && (
        <div className="mt-5 rounded-2xl bg-surface-2 p-4">
          <p className="text-xs text-white/50 mb-3">Controle remoto</p>
          {t ? (
            <>
              <div className="flex items-center gap-3 mb-3"><Cover src={t.thumbnail} size="w-16" className="rounded-lg" /><div className="min-w-0"><p className="font-semibold truncate">{t.title}</p><p className="text-sm text-white/50 truncate">{t.channel}</p></div></div>
              <input type="range" min={0} max={view.dur || 1} step={0.5} value={Math.min(view.pos, view.dur || 1)} onChange={(e) => seek(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-white/50 mb-2"><span>{fmtT(view.pos)}</span><span>{fmtT(view.dur)}</span></div>
              <div className="flex items-center justify-between px-2">
                <button onClick={toggleShuffle} className={view.shuffle ? 'text-brand-orange' : 'text-white/80'}><Icon n="shuffle" /></button>
                <button onClick={prev}><Icon n="prev" s={28} fill /></button>
                <button onClick={toggle} className="bg-white text-black rounded-full w-14 h-14 grid place-items-center"><Icon n={view.playing ? 'pause' : 'play'} s={26} fill /></button>
                <button onClick={next}><Icon n="next" s={28} fill /></button>
                <button onClick={cycleRepeat} className={view.repeat !== 'off' ? 'text-brand-orange' : 'text-white/80'}><Icon n="repeat" /></button>
              </div>
              <div className="flex items-center gap-3 mt-4 text-white/60 text-sm"><span>Volume</span><input type="range" min={0} max={100} value={view.volume} onChange={(e) => setVolume(+e.target.value)} className="flex-1" /></div>
            </>
          ) : <p className="text-white/50 text-sm">Nada tocando nesse aparelho. Busque uma música e toque nela: ela vai tocar lá.</p>}
        </div>
      )}
    </div>
  );
}
