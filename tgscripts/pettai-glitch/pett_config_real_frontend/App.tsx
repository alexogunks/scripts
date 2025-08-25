import { useState, useEffect, memo, useMemo } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import BackButtonHandler from '@components/misc/BackButtonHandler';
import ScrollToTop from '@components/misc/ScrollToTop';
import SplashScreen from '@components/splash/SplashScreen';
import { Asset } from '@hooks/useAssetDownloader';
import { useNavigationBlocker } from '@hooks/useNavigationBlocker';
import { useSplashController } from '@hooks/useSplashController';
import ConnectionErrorPage from '@pages/ConnectionErrorPage';
import { AchievementProvider } from '@providers/AchievementProvider';
import { ArtWorkProvider } from '@providers/ArtWorkProvider';
import { AuthProvider, useAuth } from '@providers/AuthProvider';
import { BalanceProvider } from '@providers/BalanceProvider';
import { BlockStateProvider } from '@providers/BlockStateProvider';
import { EventProvider } from '@providers/EventProvider';
import { GameDoorsProvider } from '@providers/games/GameDoorsProvider';
import { GuildProvider } from '@providers/GuildProvider';
import { HotelProvider } from '@providers/HotelProvider';
import '@capacitor-community/safe-area';
import { KitchenProvider } from '@providers/KitchenProvider';
import { ModalProvider } from '@providers/ModalProvider';
import { NotificationProvider } from '@providers/NotificationProvider';
import { OfficeProvider } from '@providers/OfficeProvider';
import { PetProvider } from '@providers/PetProvider';
import { PetSearchProvider } from '@providers/PetSearchProvider';
import { PrivyCustomProvider } from '@providers/PrivyCustomProvider';
import { ReferralProvider } from '@providers/ReferralProvider';
import { StakingProvider } from '@providers/StakingProvider';
import { StoreProvider } from '@providers/StoreProvider';
import { ToastProvider } from '@providers/ToastProvider';
import { WebSocketProvider, useWebSocket } from '@providers/WebSocketProvider';
import { ModalRenderer } from '@renderers/ModalRenderer';
import { ToastRenderer } from '@renderers/ToastRenderer';
import Routes from '@routes/Routes';
import { CONFIG } from '@/constants';
import './App.css';
import '@assets/styles/transitions.scss';

const ScrollToTopWrapper = memo(() => {
  const { pathname } = useLocation();

  return <ScrollToTop dependencies={[pathname]} />;
});
ScrollToTopWrapper.displayName = 'ScrollToTopWrapper';

// Component that applies navigation blocking inside Router context
const RouterWithNavigationBlocker = () => {
  const navigate = useNavigate();
  const { privyAuthenticated, ready } = useAuth();

  // Apply global navigation blocking
  useNavigationBlocker();

  // Redirect to login if authentication is lost
  useEffect(() => {
    if (ready && !privyAuthenticated) {
      console.warn('[App] Authentication lost, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [ready, privyAuthenticated, navigate]);

  return (
    <>
      <ScrollToTopWrapper />
      <BackButtonHandler />
      <Routes />
      <ModalRenderer />
      <ToastRenderer />
    </>
  );
};

const useAppLoadingState = (showContent: boolean, ready: boolean, authenticated: boolean) => {
  const [loaded, setLoaded] = useState(false);
  const [forceLoad, setForceLoad] = useState(false);
  const { wsPet } = useAuth();
  const { hasConnectionError, state } = useWebSocket();

  // Force load after 30 seconds to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.warn('[App] Force loading after 30 second timeout');
      setForceLoad(true);
    }, 30000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (loaded) {
      return;
    }

    let tempLoaded = true;

    // If splash controller says showContent is true, we should allow loading
    // even if Privy's ready state is false, since the splash controller has
    // already determined it's ready to show content
    if (!showContent) {
      tempLoaded = false;
    }

    // Don't load the app if WebSocket is not in OPEN state (stable connection)
    // But allow force loading after timeout
    if (state !== WebSocket.OPEN && !forceLoad) {
      tempLoaded = false;
    }

    // Don't load the app if WebSocket has connection errors
    // But allow force loading after timeout
    if (hasConnectionError && !forceLoad) {
      tempLoaded = false;
    }

    // Only check authentication for the main app content, not for connection status
    if (ready && authenticated && wsPet && !wsPet.active) {
      // if not minted, show mint modal
      // tempLoaded = false;
      // @TODO maybe better approach than current one in routes with `RequiresMintRoute`
    }

    setLoaded(tempLoaded);
  }, [showContent, ready, authenticated, loaded, wsPet, state, hasConnectionError, forceLoad]);

  return { loaded, hasConnectionError, state, forceLoad };
};

const AppRouter = () => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const { showContent, progress } = useSplashController(assets);
  const { ready, fullyAuthenticated } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    console.log('[App] Fetching assets list from:', CONFIG.SPLASH.ASSETS_LIST_PATH);

    fetch(CONFIG.SPLASH.ASSETS_LIST_PATH, { signal })
      .then(res => {
        if (!res.ok) {
          throw new Error(`Failed to fetch assets list: ${res.status} ${res.statusText}`);
        }

        return res.json();
      })
      .then(assetsList => {
        console.log('[App] Assets list loaded:', assetsList.length, 'assets');
        setAssets(assetsList);
      })
      .catch(err => {
        if (!signal.aborted) {
          console.error('[App] Failed to load assets list:', err);
          // Set empty array to prevent infinite loading
          setAssets([]);
        }
      });

    return () => controller.abort();
  }, []);

  const { loaded, hasConnectionError, state, forceLoad } = useAppLoadingState(showContent, ready, fullyAuthenticated);

  const routingComponent = useMemo(
    () => (
      <div className="App-content">
        <BrowserRouter>
          <RouterWithNavigationBlocker />
        </BrowserRouter>
      </div>
    ),
    [],
  );

  // Show connection error page if there's a WebSocket connection error, regardless of authentication
  if (hasConnectionError && !forceLoad) {
    return (
      <div className="App-content">
        <ConnectionErrorPage />
      </div>
    );
  }

  // Show connection error page if WebSocket is not in OPEN state, regardless of authentication
  if (state !== WebSocket.OPEN && !forceLoad) {
    return (
      <div className="App-content">
        <ConnectionErrorPage />
      </div>
    );
  }

  // Only show splash screen if not loaded (this handles authentication and other app requirements)
  if (!loaded) {
    return (
      <div className="App-content">
        <SplashScreen key={JSON.stringify(assets)} progress={progress} />
      </div>
    );
  }

  return routingComponent;
};

const App = () => (
  <div className="App">
    <EventProvider>
      <ToastProvider>
        <ModalProvider>
          <WebSocketProvider>
            <PrivyCustomProvider>
              <AuthProvider>
                <PetProvider>
                  <PetSearchProvider>
                    <BalanceProvider>
                      <ReferralProvider>
                        <AchievementProvider>
                          <StoreProvider>
                            <KitchenProvider>
                              <GuildProvider>
                                <HotelProvider>
                                  <BlockStateProvider>
                                    <ArtWorkProvider>
                                      <OfficeProvider>
                                        <StakingProvider>
                                          <NotificationProvider>
                                            <GameDoorsProvider>
                                              <AppRouter />
                                            </GameDoorsProvider>
                                          </NotificationProvider>
                                        </StakingProvider>
                                      </OfficeProvider>
                                    </ArtWorkProvider>
                                  </BlockStateProvider>
                                </HotelProvider>
                              </GuildProvider>
                            </KitchenProvider>
                          </StoreProvider>
                        </AchievementProvider>
                      </ReferralProvider>
                    </BalanceProvider>
                  </PetSearchProvider>
                </PetProvider>
              </AuthProvider>
            </PrivyCustomProvider>
          </WebSocketProvider>
        </ModalProvider>
      </ToastProvider>
    </EventProvider>
  </div>
);

export default App;
