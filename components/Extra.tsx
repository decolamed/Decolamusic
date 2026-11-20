'use client';
import React from 'react';
import { Track } from '@/lib/supabase';
import { Icon, Cover } from './Ui';
import { useOffline } from './Offline';
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
