'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Track } from '@/lib/supabase';
import { LocalMeta, listMeta, putFile, delFile } from '@/lib/local';
import { Icon, Cover } from './Ui';
import { usePlayer } from './Player';
import { useData } from './Data';

type Ctx = { files: Record<string, LocalMeta>; add: (f: FileList | File[]) => Promise<void>; remove: (key: string) => Promise<void>; toast: (m: string) => void; busy: boolean };
const C = createContext<Ctx>(null as any);
export const useLocal = () => useContext(C);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function readDuration(file: File): Promise<number> {
  return new Promise((res) => {
    const a = new Audio();
    const url = URL.createObjectURL(file);
    const done = (d: number) => { URL.revokeObjectURL(url); res(isFinite(d) ? d : 0); };
    a.preload = 'metadata';
    a.onloadedmetadata = () => done(a.duration);
    a.onerror = () => done(0);
    setTimeout(() => done(0), 5000);
    a.src = url;
  });
}

export function LocalProvider({ children }: { children: React.ReactNode }) {
  const [files, setFiles] = useState<Record<string, LocalMeta>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const t = useRef<any>(null);
  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(''), 4500); }, []);
  const refresh = useCallback(async () => { try { const l = await listMeta(); const m: Record<string, LocalMeta> = {}; l.forEach((x) => (m[x.key] = x)); setFiles(m); } catch {} }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const add = async (list: FileList | File[]) => {
    const arr = Array.from(list).filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(f.name));
    if (!arr.length) { toast('Escolha arquivos de áudio (MP3, M4A, WAV, OGG…).'); return; }
    setBusy(true);
    let ok = 0;
    try {
      navigator.storage?.persist?.();
      for (const f of arr) {
        const est = await navigator.storage?.estimate?.();
        if (est?.quota != null && est.usage != null && est.quota - est.usage < f.size * 1.2 + 10e6) { toast('Espaço insuficiente no dispositivo.'); break; }
        const duration = await readDuration(f);
        const key = 'lc:' + crypto.randomUUID();
        try {
          await putFile({ key, title: f.name.replace(/\.[^.]+$/, ''), channel: 'Meu dispositivo', thumbnail: '', duration, created: Date.now(), blob: f });
          ok++;
        } catch (e: any) { toast(e?.name === 'QuotaExceededError' ? 'Sem espaço para salvar o arquivo.' : 'Não foi possível salvar o arquivo.'); break; }
      }
    } finally { await refresh(); setBusy(false); }
    if (ok) toast(`${ok} música(s) adicionada(s)`);
  };
  const remove = async (key: string) => { await delFile(key); await refresh(); };

  return (
    <C.Provider value={{ files, add, remove, toast, busy }}>
      {children}
      {msg && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] bg-surface-3 border border-white/10 rounded-full px-4 py-2 text-sm shadow-xl animate-fadeIn max-w-[90vw] text-center">{msg}</div>}
    </C.Provider>
  );
}

export function MyMusicView({ go }: { go: (v: any) => void }) {
  const { files, add, remove, busy } = useLocal();
  const { play, current, playing } = usePlayer();
  const input = useRef<HTMLInputElement>(null);
  const items: Track[] = Object.values(files).sort((a, b) => b.created - a.created).map((m) => ({ video_id: m.key, title: m.title, channel: m.channel, thumbnail: m.thumbnail, duration: m.duration }));
  const { openMenu } = useData();
  return (
    <div className="animate-fadeIn">
      <button onClick={() => go({ name: 'library' })} className="mb-2"><Icon n="back" s={26} /></button>
      <div className="flex items-center justify-between mb-2">
        <div><h1 className="text-3xl font-extrabold">Minhas músicas</h1><p className="text-white/50 text-sm">{items.length} no seu aparelho • tocam em segundo plano</p></div>
        <button disabled={!items.length} onClick={() => play(items, 0)} className="bg-brand-orange text-black rounded-full w-14 h-14 grid place-items-center disabled:opacity-40"><Icon n="play" fill s={26} /></button>
      </div>
      <input ref={input} type="file" accept="audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} />
      <button disabled={busy} onClick={() => input.current?.click()} className="w-full my-4 bg-brand-orange text-black font-semibold rounded-full py-3 flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[.98] transition"><Icon n="plus" s={18} />{busy ? 'Salvando…' : 'Adicionar músicas do aparelho'}</button>
      {items.map((t, i) => (
        <div key={t.video_id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5">
          <button onClick={() => play(items, i)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
            <Cover src={t.thumbnail} size="w-14" className="rounded-lg" />
            <div className="min-w-0">
              <p className={`truncate font-semibold ${current?.video_id === t.video_id && playing ? 'text-brand-orange' : ''}`}>{t.title}</p>
              <p className="truncate text-sm text-white/50">{t.channel}{t.duration ? ' • ' + fmt(t.duration) : ''}</p>
            </div>
          </button>
          <button onClick={() => { if (confirm('Remover do aparelho?')) remove(t.video_id); }} className="text-white/40 hover:text-red-400 p-1"><Icon n="trash" s={20} /></button>
          <button onClick={() => openMenu(t)} className="text-white/60 p-1"><Icon n="dots" /></button>
        </div>
      ))}
      {!items.length && <p className="text-white/50">Adicione arquivos de áudio que você tem de forma legal (MP3, M4A…). Eles ficam só neste aparelho e tocam com a tela apagada.</p>}
    </div>
  );
}
