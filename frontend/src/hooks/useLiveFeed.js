import { useCallback, useEffect, useState, useRef } from 'react';

export function useLiveFeed(onTick) {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);

  // Store onTick in a mutable ref so the WebSocket does not re-open when onTick changes
  const onTickRef = useRef(onTick);
  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    let reconnectDelay = 1000;
    const isMobileDevice = typeof window !== 'undefined' && window.innerWidth < 768;
    const maxDelay = isMobileDevice ? 30000 : 10000;
    let isMounted = true;

    function connect() {
      if (!isMounted) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${protocol}//${window.location.host}/api/live/ws`);

      ws.onopen = () => {
        if (!isMounted) {
          ws.close();
          return;
        }
        setConnected(true);
        reconnectDelay = 1000; // Reset delay on successful connection
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setConnected(false);
        reconnectTimeout = setTimeout(() => {
          reconnectDelay = Math.min(reconnectDelay * 2, maxDelay);
          connect();
        }, reconnectDelay);
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setConnected(false);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const payload = JSON.parse(event.data);
          if (payload.live_mode !== undefined && !payload.type) {
            setStatus(payload);
          } else {
            setStatus((prev) => ({ ...prev, last_tick: payload.timestamp, traffic: payload.data_sources?.traffic }));
            if (onTickRef.current) {
              onTickRef.current(payload);
            }
          }
        } catch {
          /* ignore malformed messages */
        }
      };
    }

    connect();

    return () => {
      isMounted = false;
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, []); // Empty array → connection opened exactly once on mount

  return { connected, status };
}
