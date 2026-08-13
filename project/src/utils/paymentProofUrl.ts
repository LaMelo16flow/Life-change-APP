import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function extractStoragePath(stored: string): string {
  const marker = '/payment-proofs/';
  const idx = stored.indexOf(marker);
  if (idx === -1) return stored;
  return stored.slice(idx + marker.length);
}

export async function resolvePaymentProofUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  const path = extractStoragePath(stored);
  const { data, error } = await supabase.storage
    .from('payment-proofs')
    .createSignedUrl(path, 3600);

  if (error || !data) {
    console.error('Error creating signed URL for payment proof:', error);
    return null;
  }
  return data.signedUrl;
}

export function usePaymentProofUrl(stored: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    resolvePaymentProofUrl(stored).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [stored]);

  return url;
}
