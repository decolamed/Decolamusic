'use client';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase, Track } from '@/lib/supabase';
import { LocalMeta, listMeta, putFile, delFile } from '@/lib/offline';
import { useData } from './Data';

export type Job = { status: 'matching' | 'downloading' | 'done' | 'error'; progress: number; msg?: string; title: string };
type Ctx = {
  online: boolean;
  local: Record<string, LocalMeta>;
  jobs: Record<string, Job>;
  start: (t: Track) => Promise<void>;
  cancel: (key: string) => void;
  remove: (key: string) => Promise<void>;
  dismiss: (key: string) => void;
  toast: (m: string) => void;
};
const C = createContext<Ctx>(null as any);
export const useOffline = () => useContext(C);

export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token}` };
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useData();
  const [online, setOnline] = useState(true);
  const [local, setLocal] = useState<Record<string, LocalMeta>>({});
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const [msg, setMsg] = useState('');
  const aborts = useRef<Record<string, AbortController>>({});
  const toastT = useRef<any>(null);

  const toast = useCallback((m: string) => { setMsg(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setMsg(''), 4500); }, []);
  const refreshLocal = useCallback(async () => {
    try { const l = await listMeta(); const m: Record<string, LocalMeta> = {}; l.forEach((x) => (m[x.key] = x)); setLocal(m); } catch {}
  }, []);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); toast('Conexão restabelecida'); };
    const off = () => { setOnline(false); toast('Sem internet: tocando só músicas baixadas'); };
    window.addEventListener('online', on); window.addEventListener('offline', off);
    refreshLocal();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [refreshLocal, toast]);

  const setJob = (k: string, j: Partial<Job>) => setJobs((o) => ({ ...o, [k]: { ...(o[k] || { status: 'matching', progress: 0, title: '' }), ...j } }));
  const dismiss = (k: string) => setJobs((o) => { const n = { ...o }; delete n[k]; return n; });

  const start = async (t: Track) => {
    const key = t.video_id;
    if (local[key] || (jobs[key] && (jobs[key].status === 'matching' || jobs[key].status === 'downloading'))) return;
    if (!navigator.onLine) { toast('Conecte-se à internet para baixar.'); return; }
    const ac = new AbortController();
    aborts.current[key] = ac;
    setJob(key, { status: 'matching', progress: 0, title: t.title, msg: undefined });
    try {
      const est = await navigator.storage?.estimate?.();
      if (est?.quota != null && est.usage != null && est.quota - est.usage < 30e6) throw new Error('Espaço insuficiente no dispositivo.');
      navigator.storage?.persist?.();
      const headers = await authHeader();
      const jm = key, license = '', duration = t.duration || 0;
      if (!key.startsWith('jm:')) { setJob(key, { status: 'error', msg: 'Esta música não está disponível para download offline.' }); return; }
      setJob(key, { status: 'downloading', progress: 0 });
      const r = await fetch('/api/offline/file?id=' + jm, { headers, signal: ac.signal });
      if (r.status === 403) { setJob(key, { status: 'error', msg: 'Esta música não está disponível para download offline.' }); return; }
      if (r.status === 503) { setJob(key, { status: 'error', msg: 'Download offline ainda não configurado.' }); return; }
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).error || 'Falha no download.');
      const total = +(r.headers.get('content-length') || 0);
      const reader = r.body.getReader();
      const chunks: Uint8Array[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value); got += value.length;
        setJob(key, { progress: total ? got / total : -1 });
      }
      const blob = new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
      await putFile({ key, title: t.title, channel: t.channel, thumbnail: t.thumbnail, duration, license, created: Date.now(), blob });
      await refreshLocal();
      setJob(key, { status: 'done', progress: 1 });
      supabase.from('downloads').upsert({ user_id: userId, track_key: key, title: t.title, channel: t.channel, thumbnail: t.thumbnail, duration, license }).then(() => {});
      toast('Download concluído: ' + t.title);
    } catch (e: any) {
      if (e?.name === 'AbortError') dismiss(key);
      else setJob(key, { status: 'error', msg: e?.name === 'QuotaExceededError' ? 'Sem espaço para salvar o arquivo.' : e?.message || 'Erro no download.' });
    } finally {
      delete aborts.current[key];
    }
  };

  const cancel = (key: string) => aborts.current[key]?.abort();
  const remove = async (key: string) => {
    await delFile(key);
    await refreshLocal();
    dismiss(key);
    supabase.from('downloads').delete().eq('track_key', key).then(() => {});
  };

  return (
    <C.Provider value={{ online, local, jobs, start, cancel, remove, dismiss, toast }}>
      {children}
      {!online && <div className="fixed top-0 inset-x-0 z-[90] bg-brand-orange text-black text-center text-xs font-semibold py-1">Sem internet — só músicas baixadas</div>}
      {msg && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[90] bg-surface-3 border border-white/10 rounded-full px-4 py-2 text-sm shadow-xl animate-fadeIn max-w-[90vw] text-center">{msg}</div>}
    </C.Provider>
  );
}
