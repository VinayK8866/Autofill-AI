import { createClient } from '@supabase/supabase-js';
import { ENV } from '../config/env';

if (!ENV.SUPABASE_URL || !ENV.SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing Supabase configuration! VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be defined."
  );
}

export const supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);
