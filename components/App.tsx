'use client';
import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Icon, Modal, btnAccent, btnPrimary, inputCls } from './Ui';
import { DataProvider, useData } from './Data';
import { PlayerProvider } from './Player';
import { Home, Search, Library, PlaylistView, Favorites, History, Profile, View } from './Views';

function Logo({ big = false }: { big?: boolean }) {
  return (
    <div className={`flex items-center gap-2 font-extrabold ${big ? 'text-4xl' : 'text-xl'}`}>
      <span className={`${big ? 'w-12 h-12' : 'w-8 h-8'} rounded-xl bg-gradient-to-br from-brand-blue to-brand-orange grid place-items-center`}><Icon n="play" fill s={big ? 22 : 15} /></span>
      <span>Decola <span className="text-brand-orange">Music</span></span>
    </div>
  );
}

function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setMsg(error.message.includes('Invalid') ? 'E-mail ou senha incorretos.' : error.message.includes('not confirmed') ? 'Confirme seu e-mail antes de entrar.' : error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password: pass, options: { data: { display_name: name }, emailRedirectTo: window.location.origin } });
      if (error) setMsg(error.message);
      else if (!data.session) {
        const r = await supabase.auth.signInWithPassword({ email, password: pass });
        if (r.error) setMsg('Conta criada! Se pedir confirmação, desative "Confirm email" no Supabase (Authentication → Sign In / Providers → Email).');
      }
    }
    setBusy(false);
  };
  return (
    <div className="min-h-screen grid place-items-center px-5 bg-[radial-gradient(ellipse_at_top,#0f2a6b_0%,#000_60%)]">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 animate-fadeIn">
        <div className="flex justify-center mb-6"><Logo big /></div>
        <div className="flex bg-surface-2 rounded-full p-1 mb-2">
          {(['in', 'up'] as const).map((m) => <button type="button" key={m} onClick={() => { setMode(m); setMsg(''); }} className={`flex-1 py-2 rounded-full text-sm font-semibold ${mode === m ? 'bg-brand-blue' : 'text-white/60'}`}>{m === 'in' ? 'Entrar' : 'Criar conta'}</button>)}
        </div>
        {mode === 'up' && <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className={inputCls} />}
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" className={inputCls} />
        <input required type="password" minLength={6} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Senha (mín. 6 caracteres)" className={inputCls} />
        {msg && <p className="text-sm text-brand-orange">{msg}</p>}
        <button disabled={busy} className={btnAccent + ' w-full disabled:opacity-60'}>{busy ? '...' : mode === 'in' ? 'Entrar' : 'Criar conta grátis'}</button>
      </form>
    </div>
  );
}

const NAV: { v: View['name']; label: string; icon: string }[] = [
  { v: 'home', label: 'Início', icon: 'home' },
  { v: 'search', label: 'Buscar', icon: 'search' },
  { v: 'library', label: 'Biblioteca', icon: 'library' },
  { v: 'profile', label: 'Perfil', icon: 'user' }
];

function AddToPlaylist() {
  const { addTrack, openAdd, playlists, addToPlaylist, createPlaylist } = useData();
  const [name, setName] = useState('');
  const [done, setDone] = useState('');
  if (!addTrack) return null;
  const add = async (id: string, n: string) => { await addToPlaylist(id, addTrack); setDone(n); setTimeout(() => { setDone(''); openAdd(null); }, 700); };
  const create = async () => { if (!name.trim()) return; const p = await createPlaylist(name.trim()); setName(''); if (p) await add(p.id, p.name); };
  return (
    <Modal title="Adicionar à playlist" onClose={() => openAdd(null)}>
      {done ? <p className="text-brand-orange py-6 text-center font-semibold">Adicionada a “{done}” ✓</p> : (
        <>
          <div className="flex gap-2 mb-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova playlist" className={inputCls} />
            <button onClick={create} className={btnPrimary}><Icon n="plus" /></button>
          </div>
          {playlists.map((p) => <button key={p.id} onClick={() => add(p.id, p.name)} className="w-full text-left py-3 px-2 rounded-lg hover:bg-white/5">{p.name}</button>)}
        </>
      )}
    </Modal>
  );
}

function Shell({ session }: { session: Session }) {
  const [view, setView] = useState<View>({ name: 'home' });
  const [name, setName] = useState((session.user.user_metadata?.display_name as string) || session.user.email!.split('@')[0]);
  useEffect(() => {
    supabase.from('profiles').select('display_name').eq('id', session.user.id).single().then(({ data }) => data?.display_name && setName(data.display_name));
  }, [session.user.id]);
  const active = view.name === 'playlist' || view.name === 'favorites' || view.name === 'history' ? 'library' : view.name;
  return (
    <DataProvider userId={session.user.id}>
      <PlayerProvider>
        <aside className="hidden md:flex fixed left-0 top-0 bottom-[80px] w-60 flex-col gap-1 p-5 bg-surface-1 border-r border-white/5">
          <div className="mb-6"><Logo /></div>
          {NAV.map((n) => (
            <button key={n.v} onClick={() => setView({ name: n.v } as View)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${active === n.v ? 'bg-brand-blue/20 text-brand-blue font-semibold' : 'text-white/70 hover:text-white hover:bg-white/5'}`}>
              <Icon n={n.icon} />{n.label}
            </button>
          ))}
        </aside>
        <main className="md:ml-60 px-4 md:px-8 pt-6 pb-48 md:pb-32 max-w-6xl">
          <div className="md:hidden mb-5"><Logo /></div>
          {view.name === 'home' && <Home go={setView} name={name} />}
          {view.name === 'search' && <Search />}
          {view.name === 'library' && <Library go={setView} />}
          {view.name === 'playlist' && <PlaylistView id={view.id} go={setView} />}
          {view.name === 'favorites' && <Favorites />}
          {view.name === 'history' && <History />}
          {view.name === 'profile' && <Profile email={session.user.email!} name={name} userId={session.user.id} onName={setName} />}
        </main>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-14 glass border-t border-white/5 flex">
          {NAV.map((n) => (
            <button key={n.v} onClick={() => setView({ name: n.v } as View)} className={`flex-1 flex flex-col items-center justify-center text-[11px] ${active === n.v ? 'text-brand-blue' : 'text-white/60'}`}>
              <Icon n={n.icon} s={22} />{n.label}
            </button>
          ))}
        </nav>
        <AddToPlaylist />
      </PlayerProvider>
    </DataProvider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!ready) return <div className="min-h-screen grid place-items-center"><Logo big /></div>;
  return session ? <Shell session={session} /> : <Auth />;
}
