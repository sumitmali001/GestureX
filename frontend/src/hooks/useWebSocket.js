import { useState, useEffect, useRef, useCallback } from 'react';

export function useWebSocket(onEvent) {
  const [wsStatus, setWsStatus] = useState('DISCONNECTED'); // CONNECTED, CONNECTING, DISCONNECTED
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setWsStatus('CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname || '127.0.0.1';
    // Connect directly to FastAPI on port 8000 (even when frontend is on Vite port 3000)
    // This avoids Vite proxy socket ECONNABORTED issues completely
    const port = window.location.port === '3000' ? '8000' : (window.location.port || '8000');
    const wsUrl = `${protocol}//${hostname}:${port}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected to', wsUrl);
      setWsStatus('CONNECTED');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (onEventRef.current) {
          onEventRef.current(data.type, data.payload, data.timestamp);
        }
      } catch (e) {
        console.error('[WebSocket] Message parse error:', e);
      }
    };

    ws.onclose = (event) => {
      console.warn('[WebSocket] Closed:', event.code, event.reason);
      setWsStatus('DISCONNECTED');
      wsRef.current = null;
      // Reconnect after 2 seconds
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, 2000);
      }
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
      ws.close();
    };
  }, []);

  const send = useCallback((cmd, payload = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: cmd, ...payload }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { wsStatus, reconnect: connect, send };
}
