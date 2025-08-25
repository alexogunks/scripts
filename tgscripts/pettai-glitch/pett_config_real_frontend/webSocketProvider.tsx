import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { WebSocketMessage } from '@interfaces/WebSocketMessage';
import { WebSocketResponseType } from '@interfaces/WebSocketResponse';
import { EventType, useEvents } from './EventProvider';
import { useToast } from './ToastProvider';
import { CONFIG } from '@/constants';

export interface WebSocketContextType {
  state: number;
  hasConnectionError: boolean;
  failedAttempts: number;
  isAttemptingConnection: boolean;
  resetConnection: () => void;
  sendMessage: (message: WebSocketMessage) => Promise<any>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

const URL = CONFIG.WS.URL;

const RECONNECT_DELAY_DEFAULT = 0;
const RECONNECT_DELAY_MAX = CONFIG.WS.RECONNECT_DELAY_MAX;
const RECONNECT_DELAY_MIN = CONFIG.WS.RECONNECT_DELAY_MIN;

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { emit } = useEvents();
  const { showWarning } = useToast();

  const requests = useRef<Map<string, (response: any) => void>>(new Map());
  const ws = useRef<WebSocket | undefined>(undefined);

  const timeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const delay = useRef<number>(RECONNECT_DELAY_DEFAULT);
  const failedAttempts = useRef<number>(0);
  const connectionTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
  const pingInterval = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasInitialized = useRef<boolean>(false);
  const lastPetUpdateTimestamp = useRef<number>(0);

  const [state, setState] = useState<number>(WebSocket.CLOSED);
  const [hasConnectionError, setHasConnectionError] = useState<boolean>(false);
  const [isAttemptingConnection, setIsAttemptingConnection] = useState<boolean>(false);

  // Initialize connection state
  useEffect(() => {
    setState(WebSocket.CLOSED);
    setHasConnectionError(false);
    setIsAttemptingConnection(false);
  }, []);

  const clear = useCallback(() => {
    for (const [, resolve] of requests.current) {
      resolve(null);
    }

    requests.current.clear();
  }, []);

  const reset = useCallback(() => {
    clear();

    if (timeout.current) {
      clearTimeout(timeout.current);
    }

    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
    }

    if (pingInterval.current) {
      clearInterval(pingInterval.current);
    }

    if (!ws.current) {
      return;
    }

    ws.current.onopen = null;
    ws.current.onclose = null;
    ws.current.onerror = null;
    ws.current.onmessage = null;
    ws.current.close();
  }, [clear]);

  const handleMessage = useCallback(
    (data: any) => {
      // Sanitize database errors
      if (data?.error && typeof data.error === 'string' && data.error.toLowerCase().includes('prisma')) {
        console.error('[WebSocket] Database error detected:', data.error);
        data.error = 'Db ERROR';
      }

      // Check for rate limit errors
      if (data?.error && typeof data.error === 'string') {
        const errorMessage = data.error.toLowerCase();

        if (errorMessage.includes('rate limit')) {
          console.warn('[WebSocket] Rate limit exceeded:', data.error);
          showWarning('Please slow down');

          return;
        }
      }

      // FIXED: Check for authentication errors from ANY message type
      if (data?.error && typeof data.error === 'string') {
        const errorMessage = data.error.toLowerCase();

        if (
          errorMessage.includes('not authenticated') ||
          errorMessage.includes('token validation failed') ||
          errorMessage.includes('invalid or expired token') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication failed')
        ) {
          console.warn('[WebSocket] Authentication error detected:', data.error);
          emit(EventType.AuthError, { error: data.error });

          return;
        }
      }

      // Handle pet updates with better timestamp validation
      if ((data?.type === WebSocketResponseType.AUTH || data?.type === WebSocketResponseType.PET_UPDATE) && data?.pet) {
        const updateTimestamp = data?.timestamp || Date.now(); // Fallback to current time

        if (updateTimestamp <= lastPetUpdateTimestamp.current) {
          console.debug(
            '[WebSocket] Ignoring pet update with old timestamp:',
            updateTimestamp,
            'Latest:',
            lastPetUpdateTimestamp.current,
          );

          return;
        }

        lastPetUpdateTimestamp.current = updateTimestamp;
        emit(EventType.PetUpdate, {
          response: data,
        });
      }
    },
    [emit, showWarning],
  );

  const connect = useCallback(() => {
    console.log('[WebSocket] Attempting to connect to, ', URL);

    // Check if URL is valid
    if (!URL || URL.trim() === '') {
      console.error('[WebSocket] Invalid URL provided');
      setHasConnectionError(true);
      setIsAttemptingConnection(false);
      setState(WebSocket.CLOSED);

      return;
    }

    const client = new WebSocket(URL);
    ws.current = client;

    // Set connecting state immediately
    setState(WebSocket.CONNECTING);
    setIsAttemptingConnection(true);
    console.log('[WebSocket] Set connecting state');

    // Set a timeout for the connection attempt
    connectionTimeout.current = setTimeout(() => {
      if (client.readyState !== WebSocket.OPEN) {
        console.warn('[WebSocket] Connection timeout');
        failedAttempts.current += 1;

        // Show connection error after 10 failed attempts (including timeouts)
        if (failedAttempts.current >= 10) {
          console.log('[WebSocket] Setting connection error after 10 failed attempts');
          setHasConnectionError(true);
        }

        client.close();
      }
    }, 10000); // 10 second timeout

    client.onopen = () => {
      console.info('[WebSocket] Connection established.');

      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
      }

      // Start ping/pong to keep connection alive
      pingInterval.current = setInterval(() => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'PING', nonce: crypto.randomUUID(), data: {} }));
        }
      }, 10000); // Ping every 10 seconds

      delay.current = RECONNECT_DELAY_DEFAULT;
      failedAttempts.current = 0;
      setState(WebSocket.OPEN);
      setHasConnectionError(false);
      setIsAttemptingConnection(false);
      hasInitialized.current = true;
    };

    client.onclose = event => {
      console.warn('[WebSocket] Connection lost!', event.code, event.reason);

      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
      }

      if (pingInterval.current) {
        clearInterval(pingInterval.current);
      }

      failedAttempts.current += 1;

      // Show connection error after 10 failed attempts
      if (failedAttempts.current >= 10) {
        console.log('[WebSocket] Setting connection error after 10 failed attempts');
        setHasConnectionError(true);
      }

      delay.current = Math.min(delay.current + RECONNECT_DELAY_MIN, RECONNECT_DELAY_MAX);
      console.log(
        `[WebSocket] Attempting to reconnect in ${delay.current} milliseconds... (attempt ${failedAttempts.current})`,
      );
      timeout.current = setTimeout(connect, delay.current);
      setState(WebSocket.CLOSED);
      setIsAttemptingConnection(false);
      clear();
    };

    client.onerror = error => {
      console.error('[WebSocket] Error', error);
      // Don't immediately set connection error on first error
      // Let the onclose handler manage the retry logic
    };

    client.onmessage = (event: MessageEvent) => {
      // console.debug('[WebSocket] User', event.data);
      const message = JSON.parse(event.data);
      const nonce = message.nonce;
      handleMessage(message);

      if (!nonce) {
        return;
      }

      const resolve = requests.current.get(nonce);

      if (!resolve) {
        return;
      }

      requests.current.delete(nonce);
      delete message.nonce;
      resolve(message);
    };
  }, [clear, handleMessage]);

  useEffect(() => {
    if (document.readyState === 'complete') {
      connect();
    } else {
      window.addEventListener('load', connect);
    }

    return () => {
      console.log('[WebSocket] Cleaning...');
      window.removeEventListener('load', connect);

      if (connectionTimeout.current) {
        clearTimeout(connectionTimeout.current);
      }

      reset();
    };
  }, [reset, connect]);

  const resetConnection = useCallback(() => {
    reset();
    failedAttempts.current = 0;
    setHasConnectionError(false);
    setIsAttemptingConnection(false);
    connect();
  }, [reset, connect]);

  const sendMessage = useCallback((message: WebSocketMessage): Promise<any> => {
    return new Promise(resolve => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
        resolve(null);

        return;
      }

      const nonce = crypto.randomUUID();
      requests.current.set(nonce, resolve);
      ws.current.send(JSON.stringify({ ...message, nonce }));
    });
  }, []);

  return (
    <WebSocketContext.Provider
      value={{
        resetConnection,
        sendMessage,
        state,
        hasConnectionError,
        failedAttempts: failedAttempts.current,
        isAttemptingConnection,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);

  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }

  return context;
};
