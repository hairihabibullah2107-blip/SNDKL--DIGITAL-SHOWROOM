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
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:')) return path;
  const normalized = path.replace(/^\/+/, '').replace(/^showroom-product-images\//, '');
  return supabase.storage.from('showroom-product-images').getPublicUrl(normalized).data.publicUrl;
}

export function dataUrlToBase64(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

export async function artworkForUpload(dataUrl: string, fileName: string): Promise<{ design_base64: string; design_name: string }> {
  const sourceName = fileName || 'artwork';
  const mime = /^data:([^;,]+)/i.exec(dataUrl)?.[1]?.toLowerCase() || '';
  if (mime === 'application/pdf' || sourceName.toLowerCase().endsWith('.pdf')) {
    return { design_base64: dataUrlToBase64(dataUrl), design_name: sourceName.toLowerCase().endsWith('.pdf') ? sourceName : sourceName + '.pdf' };
  }
  if (mime.startsWith('image/')) {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(4096, Math.max(512, image.naturalWidth || 1200));
    canvas.height = Math.min(4096, Math.max(512, image.naturalHeight || 1200));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Browser tidak dapat memproses file desain.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const baseName = sourceName.replace(/\.[^.]+$/, '') || 'artwork';
    return { design_base64: dataUrlToBase64(canvas.toDataURL('image/png')), design_name: baseName + '.png' };
  }
  const fallbackName = /\.(png|jpe?g|webp|pdf)$/i.test(sourceName) ? sourceName : sourceName + '.png';
  return { design_base64: dataUrlToBase64(dataUrl), design_name: fallbackName };
}
