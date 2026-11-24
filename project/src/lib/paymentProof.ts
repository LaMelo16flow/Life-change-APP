import { supabase } from './supabase';

/** Uploads the payment screenshot to the private payment-proofs bucket and returns its path. */
export async function uploadPaymentProof(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('payment-proofs').upload(path, file);
  if (error) throw error;
  return path;
}

export async function removePaymentProof(path: string) {
  await supabase.storage.from('payment-proofs').remove([path]);
}
