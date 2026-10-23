import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export type UserRole = 'student' | 'mentor' | 'hod';

export type UserProfile = {
  id: string;
  role: UserRole;
  full_name: string;
  roll_number: string | null;
  email: string;
  department: string | null;
  year: string | null;
  section: string | null;
};
