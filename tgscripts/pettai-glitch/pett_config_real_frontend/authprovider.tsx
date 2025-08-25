import {
    createContext,
    MouseEvent,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
  } from 'react';
  import {
    WebSocketMessage,
    WebSocketMessageDataAuth,
    WebSocketMessageDataRegister,
    WebSocketMessageType,
  } from '@interfaces/WebSocketMessage';
  import { WebSocketPet, WebSocketResponse, WebSocketResponseUpdate, WebSocketUser } from '@interfaces/WebSocketResponse';
  import { ConnectedWallet, LoginModalOptions, usePrivy, User, useWallets } from '@privy-io/react-auth';
  import { withSafeRetry } from '@utils/async';
  import { EventType, IEventListener, IEventPetUpdate, IEventAuthError, useEvents } from './EventProvider';
  import { useModal } from './ModalProvider';
  import { useWebSocket } from './WebSocketProvider';
  import { CONFIG } from '@/constants';
  
  export interface AuthContextType {
    wsAuthenticated: boolean;
    fullyAuthenticated: boolean;
    privyAuthenticated: boolean;
    authFailed: boolean;
    wsPet: WebSocketPet | null;
    wsUser: WebSocketUser | null;
    privyUser: User | null;
    isModalOpen: boolean;
    ready: boolean;
    wallet: ConnectedWallet;
    logout: () => void;
    login: (options?: LoginModalOptions | MouseEvent<any, any>) => void;
    registerUser: (name: string) => Promise<boolean>;
    sendAuthenticatedMessage: (message: WebSocketMessage) => Promise<any>;
    retryAuthentication: () => void;
  }
  
  interface MessageRequest {
    message: WebSocketMessage;
    resolve: (response: any) => void;
  }
  
  const AuthContext = createContext<AuthContextType | undefined>(undefined);
  
  const AUTH_RETRIES = 3;
  
  const AUTH_TOKEN = CONFIG.WS.TOKEN;
  const AUTH_REFRESH_INTERVAL = CONFIG.WS.AUTH_REFRESH_INTERVAL;
  
  export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {
      ready,
      login,
      isModalOpen,
      user: privyUser,
      logout: privyLogout,
      authenticated: privyAuthenticated,
      getAccessToken: privyGetAccessToken,
    } = usePrivy();
  
    const { closeModal, openModal } = useModal();
  
    const { listen } = useEvents();
    const { wallets } = useWallets();
    const { state, resetConnection, sendMessage } = useWebSocket();
  
    const authenticated = useRef<boolean>(false);
    const authenticating = useRef<boolean>(false);
    const authFailed = useRef<boolean>(false);
    const interval = useRef<NodeJS.Timer | undefined>(undefined);
    const retryAuthRef = useRef<() => void>();
    const authResultListener = useRef<IEventListener | null>(null);
    const authErrorListener = useRef<IEventListener | null>(null);
    const messageQueue = useRef<MessageRequest[]>([]);
  
    const [wsUser, setWsUser] = useState<WebSocketUser | null>(null);
    const [wsPet, setWsPet] = useState<WebSocketPet | null>(null);
    const [fullyAuthenticated, setFullyAuthenticated] = useState<boolean>(false);
    const [wsAuthenticated, setWsAuthenticated] = useState<boolean>(false);
    const [authFailedState, setAuthFailedState] = useState<boolean>(false);
  
    const wallet = useMemo(() => wallets[0], [wallets]);
  
    const clearMessageQueue = useCallback(() => {
      while (messageQueue.current.length > 0) {
        const messageRequest = messageQueue.current.shift();
  
        if (!messageRequest) {
          return;
        }
  
        const { resolve } = messageRequest;
        resolve(null);
      }
    }, []);
  
    const exhaustMessageQueue = useCallback(async () => {
      while (messageQueue.current.length > 0) {
        if (!authenticated.current) {
          return;
        }
  
        const messageRequest = messageQueue.current.shift();
  
        if (!messageRequest) {
          return;
        }
  
        const { message, resolve } = messageRequest;
        const response = await sendMessage(message);
        resolve(response);
      }
    }, [sendMessage]);
  
    const sendAuthenticatedMessage = useCallback(
      (message: WebSocketMessage): Promise<any> => {
        if (authenticated.current) {
          return sendMessage(message);
        }
  
        return new Promise(resolve => messageQueue.current.push({ message, resolve }));
      },
      [sendMessage],
    );
  
    const auth = useCallback(
      (accessToken: string): Promise<WebSocketResponseUpdate> => {
        const params: WebSocketMessageDataAuth = { authType: 'privy', authHash: { hash: `Bearer ${accessToken}` } };
        const message: WebSocketMessage<WebSocketMessageDataAuth> = { type: WebSocketMessageType.AUTH, data: { params } };
  
        return sendMessage(message);
      },
      [sendMessage],
    );
  
    const register = useCallback(
      (accessToken: string, name: string): Promise<WebSocketResponse> => {
        const params: WebSocketMessageDataRegister = {
          authType: 'privy',
          registerHash: { hash: `Bearer ${accessToken}`, name },
        };
        const message: WebSocketMessage<WebSocketMessageDataRegister> = {
          type: WebSocketMessageType.REGISTER,
          data: { params },
        };
  
        return sendMessage(message);
      },
      [sendMessage],
    );
  
    const stopAuthRetries = useCallback(() => {
      if (interval.current) {
        clearInterval(interval.current);
        interval.current = undefined;
      }
  
      authFailed.current = true;
      setAuthFailedState(true);
      authenticating.current = false;
    }, []);
  
    const clear = useCallback(() => {
      authenticated.current = false;
      authenticating.current = false;
      authFailed.current = false;
      setAuthFailedState(false);
      setFullyAuthenticated(false);
      setWsUser(null);
      setWsPet(null);
      clearMessageQueue();
    }, [clearMessageQueue]);
  
    const logout = useCallback(async () => {
      await privyLogout();
      resetConnection();
      closeModal();
      clear();
    }, [clear, closeModal, privyLogout, resetConnection]);
  
    const getAccessToken = useCallback(() => {
      if (AUTH_TOKEN) {
        return AUTH_TOKEN;
      }
  
      return privyGetAccessToken();
    }, [privyGetAccessToken]);
  
    const authenticate = useCallback(async () => {
      if (!privyAuthenticated || state !== WebSocket.OPEN) {
        return;
      }
  
      // Don't re-authenticate if already authenticated
      if (authenticated.current) {
        return;
      }
  
      // Don't retry if authentication has failed
      if (authFailed.current) {
        return;
      }
  
      const token = await getAccessToken();
  
      if (!token) {
        return;
      }
  
      const response = await withSafeRetry(() => auth(token), AUTH_RETRIES);
  
      // Check for authentication errors that indicate invalid/expired token
      if (response && response.error) {
        const errorMessage = response.error.toLowerCase();
  
        // Handle various authentication error messages
        if (
          errorMessage.includes('invalid') ||
          errorMessage.includes('expired') ||
          errorMessage.includes('unauthorized') ||
          errorMessage.includes('authentication failed') ||
          errorMessage.includes('jwt expired')
        ) {
          console.warn('[Auth] Invalid or expired token detected:', response.error);
  
          // Stop authentication retries
          stopAuthRetries();
  
          // Show error modal with the error message and retry option
          openModal('error', {
            title: 'Authentication Error',
            content: response.error || "Couldn't login",
            buttonText: 'Retry',
            buttonOnClick: () => {
              retryAuthRef.current?.();
            },
          });
          throw new Error(response.error);
        } else if (errorMessage.includes('this.prisma.user.findUnique()')) {
          console.warn('[Auth] User not found:', response.error);
  
          // Stop authentication retries
          stopAuthRetries();
  
          // Show error modal for database errors with retry option
          openModal('error', {
            title: 'Service Error',
            content: 'Application is down',
            buttonText: 'Retry',
            buttonOnClick: () => {
              retryAuthRef.current?.();
            },
          });
          throw new Error('Application is down');
        } else {
          // Stop authentication retries
          stopAuthRetries();
  
          // Show error modal for any other authentication error
          openModal('error', {
            title: 'Authentication Error',
            content: response.error || "Couldn't login",
            buttonText: 'Retry',
            buttonOnClick: () => {
              retryAuthRef.current?.();
            },
          });
        }
      }
  
      // If user is not registered, try to auto-register
      if (response && response.error?.includes('User not found with privy ID:')) {
        console.log('[Auth] User not found, attempting auto-registration...');
  
        try {
          const name = privyUser?.telegram?.username ?? privyUser?.wallet?.address?.slice(0, 8) ?? `pettai_${Date.now().toString(36)}`;
          const registerResponse = await withSafeRetry(() => register(token, name), AUTH_RETRIES);
  
          if (registerResponse && registerResponse.success) {
            console.log('[Auth] Auto-registration successful, re-authenticating...');
            // Re-authenticate after successful registration
            const reAuthResponse = await withSafeRetry(() => auth(token), AUTH_RETRIES);
  
            if (reAuthResponse && reAuthResponse.success) {
              authenticated.current = true;
              authFailed.current = false;
              setAuthFailedState(false);
              setWsAuthenticated(true);
  
              if (reAuthResponse.user) {
                setWsUser(reAuthResponse.user);
              }
  
              setWsPet(reAuthResponse.pet);
              setFullyAuthenticated(true);
              exhaustMessageQueue();
  
              return;
            }
          }
  
          console.warn('[Auth] Auto-registration failed:', registerResponse);
  
          // If auto-registration fails, show error modal
          stopAuthRetries();
          openModal('error', {
            title: 'Registration Error',
            content: registerResponse?.error || 'Failed to create account automatically',
            buttonText: 'Retry',
            buttonOnClick: () => {
              retryAuthRef.current?.();
            },
          });
  
        } catch (error) {
          console.error('[Auth] Auto-registration error:', error);
  
          // If auto-registration fails, show error modal
          stopAuthRetries();
          openModal('error', {
            title: 'Registration Error',
            content: 'Failed to create account automatically',
            buttonText: 'Retry',
            buttonOnClick: () => {
              retryAuthRef.current?.();
            },
          });
        }
  
        return;
      }
  
      if (response && response.success) {
        authenticated.current = true;
        authFailed.current = false;
        setAuthFailedState(false);
        setWsAuthenticated(true);
  
        if (response.user) {
          setWsUser(response.user);
        }
  
        setWsPet(response.pet);
        setFullyAuthenticated(true);
        exhaustMessageQueue();
  
        return;
      }
  
      // For any other authentication failure, show error modal
      console.warn('[Auth] Authentication failed with response:', response);
  
      // Stop authentication retries
      stopAuthRetries();
  
      openModal('error', {
        title: 'Authentication Error',
        content: response?.error || "Couldn't login",
        buttonText: 'Retry',
        buttonOnClick: () => {
          retryAuthRef.current?.();
        },
      });
    }, [auth, state, privyAuthenticated, getAccessToken, exhaustMessageQueue, openModal, stopAuthRetries, privyUser, register]);
  
    const updateAuthentication = useCallback(
      async (init?: boolean) => {
        if (init && authenticated.current) {
          return;
        }
  
        if (authenticating.current) {
          return;
        }
  
        authenticating.current = true;
        await authenticate();
        authenticating.current = false;
      },
      [authenticate],
    );
  
    const registerUser = useCallback(
      async (name: string) => {
        const token = await getAccessToken();
  
        if (!token) {
          return false;
        }
  
        const response = await withSafeRetry(() => register(token, name));
        await updateAuthentication(true);
  
        return !!(response && response.success);
      },
      [register, updateAuthentication, getAccessToken],
    );
  
    const retryAuthentication = useCallback(() => {
      console.log('[Auth] Manual retry requested');
  
      // Reset auth failed state
      authFailed.current = false;
      setAuthFailedState(false);
  
      // Close any open modals
      closeModal();
  
      // Start authentication attempts again
      if (interval.current) {
        clearInterval(interval.current);
      }
  
      interval.current = setInterval(updateAuthentication, AUTH_REFRESH_INTERVAL);
      updateAuthentication(true);
    }, [closeModal, updateAuthentication]);
  
    // Update the ref with the current retry function
    retryAuthRef.current = retryAuthentication;
  
    useEffect(() => {
      if (state === WebSocket.CLOSED) {
        authenticated.current = false;
        setWsAuthenticated(false);
        setFullyAuthenticated(false);
      }
  
      // Don't automatically reset auth failed flag when WebSocket reconnects
      // User should manually retry via the retry button in error modal
  
      // Clear existing interval
      if (interval.current) {
        clearInterval(interval.current);
      }
  
      // Only start new interval if auth hasn't failed
      if (!authFailed.current) {
        interval.current = setInterval(updateAuthentication, AUTH_REFRESH_INTERVAL);
        updateAuthentication(true);
      }
  
      return () => {
        if (interval.current) {
          clearInterval(interval.current);
        }
      };
    }, [state, privyUser, updateAuthentication]);
  
    useEffect(() => {
      if (!authResultListener.current) {
        authResultListener.current = listen(EventType.PetUpdate, (event: IEventPetUpdate) => {
          setWsPet(event.response.pet);
        });
      }
  
      if (!authErrorListener.current) {
        authErrorListener.current = listen(EventType.AuthError, (event: IEventAuthError) => {
          console.warn('[Auth] Authentication error received from WebSocket:', event.error);
  
          // Stop authentication retries
          stopAuthRetries();
  
          openModal('error', {
            title: 'Authentication Error',
            content: event.error || "Couldn't login",
            buttonText: 'Retry',
            buttonOnClick: () => {
              retryAuthRef.current?.();
            },
          });
        });
      }
    }, [listen, openModal, stopAuthRetries]);
  
    return (
      <AuthContext.Provider
        value={{
          sendAuthenticatedMessage,
          wsAuthenticated,
          fullyAuthenticated,
          privyAuthenticated,
          authFailed: authFailedState,
          wsPet,
          wsUser,
          privyUser,
          isModalOpen,
          ready,
          wallet,
          logout,
          login,
          registerUser,
          retryAuthentication,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
  
  export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
  
    if (context === undefined) {
      throw new Error('useAuth must be used within a AuthProvider');
    }
  
    return context;
  };
  