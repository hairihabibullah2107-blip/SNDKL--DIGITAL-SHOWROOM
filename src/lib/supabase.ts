import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bpfurmqbtredhipendpz.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_48Rc2wmf29Jfss6O0XMZnw_FLZMOGpC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const SHOWROOM_API = `${SUPABASE_URL}/functions/v1/showroom-public-api`;

export async function invokeShowroom<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('showroom-public-api', {
    body: payload,
  });
  if (error) throw error;
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}

export function storagePublicUrl(path: string | null | undefined): string {
  if (!path) return '';
  return supabase.storage.from('showroom-product-images').getPublicUrl(path).data.publicUrl;
}

export function dataUrlToBase64(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}
