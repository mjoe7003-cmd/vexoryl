import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useWallet(userId) {
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      setWallet(null);
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const loadWallet = async () => {
      const { data, error: fetchError } = await supabase
        .from('wallets')
        .select('id, user_id, balance, pending_balance, currency, updated_at')
        .eq('user_id', userId)
        .maybeSingle();
      if (!active) return;
      if (fetchError) setError(fetchError);
      else setWallet(data);
      setLoading(false);
    };

    loadWallet();
    const channel = supabase.channel(`wallet-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'wallets',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (active && payload.new) setWallet(payload.new);
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && active) setError(new Error('Wallet realtime connection failed'));
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { wallet, loading, error };
}

export default useWallet;