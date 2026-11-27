import type { SupabaseClient } from '@supabase/supabase-js';

/** Persistence helpers for the dd_* migration. RLS remains authoritative. */
export class WardrobeStore {
  private readonly sb: SupabaseClient;
  constructor(sb: SupabaseClient) { this.sb = sb; }
  private async owner() {
    const { data, error } = await this.sb.auth.getUser();
    if (error || !data.user) throw new Error('Sign in to your wardrobe');
    return data.user.id;
  }
  async items() {
    const uid = await this.owner();
    const { data, error } = await this.sb.from('dd_items').select('*').eq('user_id', uid).eq('is_archived', false).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  async profile() {
    const uid = await this.owner();
    const { data, error } = await this.sb.from('dd_profiles').select('data').eq('user_id', uid).maybeSingle();
    if (error) throw error;
    return data?.data || {};
  }
  async saveProfile(profile: Record<string, unknown>) {
    const uid = await this.owner();
    const { error } = await this.sb.from('dd_profiles').upsert({ user_id: uid, data: profile });
    if (error) throw error;
  }
  async saveMeasurements(itemId: string, measurements: Record<string, number | null>) {
    const uid = await this.owner();
    const { data, error } = await this.sb.from('dd_items').update({ measurements }).eq('id', itemId).eq('user_id', uid).select('id');
    if (error) throw error;
    if (!data?.length) throw new Error('Garment not found');
  }
  async feedback(outfitId: string, liked: boolean) {
    const uid = await this.owner();
    const { error } = await this.sb.from('dd_feedback').upsert({ user_id: uid, outfit_id: outfitId, liked });
    if (error) throw error;
  }
  async upload(bytes: ArrayBuffer, uniqueName: string, mime: string) {
    const uid = await this.owner();
    if (!/^[a-zA-Z0-9_-]+\.(png|jpe?g|webp|heic|heif)$/i.test(uniqueName)) throw new Error('Use a unique image filename');
    const path = `${uid}/uploads/${uniqueName}`;
    const { error } = await this.sb.storage.from('dd-private').upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw error;
    return path;
  }
  async signedImage(path: string) {
    const uid = await this.owner();
    if (!path.startsWith(uid + '/')) throw new Error('Image belongs to another user');
    const { data, error } = await this.sb.storage.from('dd-private').createSignedUrl(path, 600);
    if (error) throw error;
    return data.signedUrl;
  }
  async previews() {
    const uid = await this.owner();
    const { data, error } = await this.sb.from('dd_preview_jobs').select('*').eq('user_id', uid).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }
  async deletePreview(id: string) {
    const uid = await this.owner();
    const { data: job, error } = await this.sb.from('dd_preview_jobs').select('*').eq('id', id).eq('user_id', uid).single();
    if (error) throw error;
    if (job.data.status === 'processing') throw new Error('Wait for the preview to finish');
    const paths = [job.data.person_path, job.data.result_path].filter((path): path is string => typeof path === 'string' && path.startsWith(uid + '/'));
    const removed = await this.sb.storage.from('dd-private').remove(paths);
    if (removed.error) throw removed.error;
    const deleted = await this.sb.from('dd_preview_jobs').delete().eq('id', id).eq('user_id', uid);
    if (deleted.error) throw deleted.error;
  }
}
