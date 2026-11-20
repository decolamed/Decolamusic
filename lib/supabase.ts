import { createClient } from '@supabase/supabase-js';
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://rwsqpcjylxbljkcciqpk.supabase.co';
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_J_-TdepyArG2Lh56f9M5GA_Q9MVFHh4';
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export type Track = { video_id: string; title: string; channel: string; thumbnail: string };
export type Playlist = { id: string; name: string; description: string | null; created_at: string; cover?: string; count?: number };
