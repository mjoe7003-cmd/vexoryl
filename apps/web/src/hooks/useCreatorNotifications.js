import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';

export function useCreatorNotifications(userId) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!userId || !import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return undefined;
    const channel = supabase.channel(`creator-notifications-${userId}`)
      .on('broadcast', { event: 'creator-notification' }, ({ payload }) => {
        setNotifications((current) => [{ ...payload, id: crypto.randomUUID() }, ...current].slice(0, 8));
      })
      .subscribe((status) => console.log('[Vexoryl] creator notification channel', { userId, status }));
    return () => supabase.removeChannel(channel);
  }, [userId]);

  return { notifications };
}

export default useCreatorNotifications;
