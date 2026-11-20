'use client';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase, Track, Playlist } from '@/lib/supabase';

type Ctx = {
  userId: string;
  playlists: Playlist[];
  favs: Track[];
  favIds: Set<string>;
  refresh: () => Promise<void>;
  toggleFav: (t: Track) => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist | null>;
  addToPlaylist: (pid: string, t: Track) => Promise<void>;
  addTrack: Track | null;
  openAdd: (t: Track | null) => void;
  menuTrack: Track | null;
  openMenu: (t: Track | null) => void;
};
const C = createContext<Ctx>(null as any);
export const useData = () => useContext(C);

export function DataProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favs, setFavs] = useState<Track[]>([]);
  const [addTrack, openAdd] = useState<Track | null>(null);
  const [menuTrack, openMenu] = useState<Track | null>(null);

  const refresh = useCallback(async () => {
    const [pl, pt, fv] = await Promise.all([
      supabase.from('playlists').select('*').order('created_at', { ascending: false }),
      supabase.from('playlist_tracks').select('playlist_id,thumbnail,position').order('position'),
      supabase.from('favorites').select('video_id,title,channel,thumbnail').order('created_at', { ascending: false })
    ]);
    if (pl.error || fv.error) {
      try { const c = JSON.parse(localStorage.getItem('dm-cache') || '{}'); setPlaylists(c.playlists || []); setFavs(c.favs || []); } catch {}
      return;
    }
    const cover: Record<string, string> = {};
    const count: Record<string, number> = {};
    (pt.data || []).forEach((r: any) => {
      if (!cover[r.playlist_id]) cover[r.playlist_id] = r.thumbnail;
      count[r.playlist_id] = (count[r.playlist_id] || 0) + 1;
    });
    const plist = ((pl.data as Playlist[]) || []).map((p) => ({ ...p, cover: cover[p.id], count: count[p.id] || 0 }));
    setPlaylists(plist);
    setFavs((fv.data as Track[]) || []);
    try { localStorage.setItem('dm-cache', JSON.stringify({ playlists: plist, favs: fv.data })); } catch {}
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const favIds = new Set(favs.map((f) => f.video_id));

  const toggleFav = async (t: Track) => {
    if (favIds.has(t.video_id)) {
      setFavs((f) => f.filter((x) => x.video_id !== t.video_id));
      await supabase.from('favorites').delete().eq('video_id', t.video_id);
    } else {
      setFavs((f) => [t, ...f]);
      await supabase.from('favorites').upsert({ user_id: userId, video_id: t.video_id, title: t.title, channel: t.channel, thumbnail: t.thumbnail });
    }
  };

  const createPlaylist = async (name: string) => {
    const { data } = await supabase.from('playlists').insert({ user_id: userId, name }).select().single();
    await refresh();
    return (data as Playlist) || null;
  };

  const addToPlaylist = async (pid: string, t: Track) => {
    const { count } = await supabase.from('playlist_tracks').select('id', { count: 'exact', head: true }).eq('playlist_id', pid);
    await supabase.from('playlist_tracks').upsert(
      { playlist_id: pid, user_id: userId, video_id: t.video_id, title: t.title, channel: t.channel, thumbnail: t.thumbnail, position: count || 0 },
      { onConflict: 'playlist_id,video_id', ignoreDuplicates: true }
    );
    await refresh();
  };

  return <C.Provider value={{ userId, playlists, favs, favIds, refresh, toggleFav, createPlaylist, addToPlaylist, addTrack, openAdd, menuTrack, openMenu }}>{children}</C.Provider>;
}
