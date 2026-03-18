import { useEffect, useState, useCallback, useRef } from 'react';
import { realtime, type RealtimeEvent } from '@/lib/realtime';
import { useAuth } from '@/lib/auth-context';

export function useRealtime(onEvent?: (event: RealtimeEvent) => void) {
  const { isAuthenticated } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsub = realtime.subscribe((event) => {
      if (event.type === 'notification_count') {
        setUnreadCount(event.data as number);
      }
      onEvent?.(event);
    });

    realtime.retain();

    return () => {
      unsub();
      realtime.release();
    };
  }, [isAuthenticated, onEvent]);

  return { unreadCount };
}

export function useRealtimeRefresh(callback: () => void, eventTypes: RealtimeEvent['type'][]) {
  const { isAuthenticated } = useAuth();
  const stableCallback = useCallback(callback, [callback]);

  // FIX: Stabilize eventTypes array — the caller passes a new array literal
  // on every render (e.g. ['new_message', ...]) which would cause the effect
  // to re-run, creating duplicate subscriptions. We use a ref + join comparison
  // to keep a stable reference.
  const eventTypesRef = useRef(eventTypes);
  const eventTypesKey = eventTypes.join(',');
  useEffect(() => { eventTypesRef.current = eventTypes; }, [eventTypesKey]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsub = realtime.subscribe((event) => {
      if (eventTypesRef.current.includes(event.type)) {
        stableCallback();
      }
    });

    realtime.retain();

    return () => {
      unsub();
      realtime.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, stableCallback, eventTypesKey]);
}
