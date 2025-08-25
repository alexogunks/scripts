import { lazy } from 'react';
import { Routes, Navigate, Outlet, Route } from 'react-router-dom';
import BlockStateWrapper from '@components/misc/BlockStateWrapper';
import AuthLayout from '@layouts/AuthLayout';
import CloudSitLayout from '@layouts/CloudSitLayout';
import DashboardLayout from '@layouts/DashboardLayout';
import MintLayout from '@layouts/MintLayout';
import ArtWorkPage from '@pages/artwork/ArtWorkPage';
import LoginPage from '@pages/auth/LoginPage';
import ATMPage from '@pages/balance/ATMPage';
import TransactionHistoryPage from '@pages/balance/TransactionHistoryPage';
import TransactionPage from '@pages/balance/TransactionPage';
import TransferPage from '@pages/balance/TransferPage';
import WithdrawPage from '@pages/balance/WithdrawPage';
import CookieJarCurrentStakingPage from '@pages/cookie_jar/CookieJarCurrentStakingPage';
import CookieJarPage from '@pages/cookie_jar/CookieJarPage';
import DashboardPage from '@pages/DashboardPage';
import GameKingOfTheHillPage from '@pages/game/GameKingOfTheHillPage';
import GamePokerPage from '@pages/game/GamePokerPage';
import GamesPage from '@pages/game/GamesPage';
import GuildDetailsPage from '@pages/guild/GuildDetailsPage';
import GuildPage from '@pages/guild/GuildPage';
import GuildSettingsPage from '@pages/guild/GuildSettingsPage';
import HotelActivePage from '@pages/hotel/HotelActivePage';
import HotelBoughtPage from '@pages/hotel/HotelBoughtPage';
import HotelPage from '@pages/hotel/HotelPage';
import HotelRoomsPage from '@pages/hotel/HotelRoomsPage';
import InventoryGroupPage from '@pages/inventory/InventoryGroupPage';
import InventoryPage from '@pages/inventory/InventoryPage';
import JourneyAchievementsPage from '@pages/journey/JourneyAchievementsPage';
import JourneyHistoryPage from '@pages/journey/JourneyHistoryPage';
import JourneyPage from '@pages/journey/JourneyPage';
import KitchenFridgePage from '@pages/kitchen/KitchenFridgePage';
import KitchenGroceryPage from '@pages/kitchen/KitchenGroceryPage';
import KitchenPage from '@pages/kitchen/KitchenPage';
import MintPage from '@pages/mint/MintPage';
import NotificationDetailsPage from '@pages/notification/NotificationDetailsPage';
import NotificationsPage from '@pages/notification/NotificationsPage';
import OfficePage from '@pages/office/OfficePage';
import DeadPage from '@pages/pet/DeadPage';
import PetPersonalityPage from '@pages/pet/PetPersonalityPage';
import PetPersonalizePage from '@pages/pet/PetPersonalizePage';
import PlaceAITerminalPage from '@pages/place/PlaceAITerminalPage';
import PlaceBathroomPage from '@pages/place/PlaceBathroomPage';
import PlaceBedroomPage from '@pages/place/PlaceBedroomPage';
import PlaceWallStreetPage from '@pages/place/PlaceWallStreetPage';
import PredictionPage from '@pages/prediction/PredictionPage';
import ProfilePage from '@pages/profile/ProfilePage';
import WorldIDPage from '@pages/profile/WorldIDPage';
import ReferralsPage from '@pages/referrals/ReferralsPage';
import StoreGroupPage from '@pages/store/StoreGroupPage';
import StorePage from '@pages/store/StorePage';
import { useAuth } from '@providers/AuthProvider';

// Lazy loading
const GameDoorsPage = lazy(() => import('@pages/game/GameDoorsPage'));
const GameDicesPage = lazy(() => import('@pages/game/GameDicesPage'));
const GameWordlePage = lazy(() => import('@pages/game/GameWordlePage'));
const GameSlotsPage = lazy(() => import('@pages/game/GameSlotsPage'));
const GameThrowBallPage = lazy(() => import('@pages/game/GameThrowBallPage'));

const createRoutes = <
  T extends Record<
    string,
    | `/${string}`
    | {
      _: `/${string}`;
      [key: string]: `/${string}`;
    }
  >,
>(
  routes: T,
) => routes;

const ROUTES = createRoutes({
  ai_terminal: '/ai_terminal',
  artwork: '/artwork',
  bathroom: '/bathroom',
  bedroom: '/bedroom',
  cookie_jar: {
    _: '/cookie_jar',
    current: '/cookie_jar/current',
  },
  dashboard: '/dashboard',
  dead: '/dead',
  game: {
    _: '/game',
    doors: '/game/doors',
    dices: '/game/dices',
    king_of_the_hill: '/game/king_of_the_hill',
    slots: '/game/slots',
    wordle: '/game/wordle',
    throw_ball: '/game/throw_ball',
    poker: '/game/poker',
  },
  guild: {
    _: '/guild',
    show: '/guild/:id',
    settings: '/guild/settings',
  },
  hotel: {
    _: '/hotel',
    active: '/hotel/active',
    bought: '/hotel/bought',
    rooms: '/hotel/rooms',
  },
  inventory: {
    _: '/inventory',
    group: '/inventory/:group',
  },
  journey: {
    _: '/journey',
    achievements: '/journey/achievements/:type',
    history: '/journey/history',
  },
  kitchen: {
    _: '/kitchen',
    fridge: '/kitchen/fridge',
    grocery: '/kitchen/grocery',
  },
  login: '/login',
  mint: '/mint',
  notifications: {
    _: '/notifications',
    show: '/notifications/:id',
  },
  office: '/office',
  pet: {
    _: '/pet',
    personalize: '/pet/personalize',
    personality: '/pet/personality',
  },
  prediction: '/prediction',
  profile: {
    _: '/profile',
    atm: '/profile/atm',
    history: '/profile/history',
    transaction: '/profile/transaction/:id',
    transfer: '/profile/transfer',
    withdraw: '/profile/withdraw',
    world: '/profile/world',
  },
  referrals: '/referrals',
  store: {
    _: '/store',
    group: '/store/:group',
  },
  wall_street: '/wall_street',
} as const);

export type RouteName = FlattenRoutes<typeof ROUTES>;

type StringKeys<T> = Extract<keyof T, string>;
type RouteParams<T extends RouteName> = ExtractParams<GetRoutePath<T>>;
type IsEmptyObject<T> = keyof T extends never ? true : false;

type FlattenRoutes<T, Prefix extends string = ''> = {
  [K in StringKeys<T>]: T[K] extends string
  ? Prefix extends ''
  ? K
  : `${Prefix}.${K}`
  : T[K] extends Record<string, any>
  ? T[K] extends { _: string }
  ?
  | (Prefix extends '' ? K : `${Prefix}.${K}`)
  | FlattenRoutes<Omit<T[K], '_'>, Prefix extends '' ? K : `${Prefix}.${K}`>
  : FlattenRoutes<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
  : never;
}[StringKeys<T>];

type GetRoutePath<T extends string> = T extends `${infer First}.${infer Rest}`
  ? First extends keyof typeof ROUTES
  ? (typeof ROUTES)[First] extends Record<string, any>
  ? Rest extends keyof (typeof ROUTES)[First]
  ? (typeof ROUTES)[First][Rest] extends string
  ? (typeof ROUTES)[First][Rest]
  : never
  : never
  : never
  : never
  : T extends keyof typeof ROUTES
  ? (typeof ROUTES)[T] extends string
  ? (typeof ROUTES)[T]
  : (typeof ROUTES)[T] extends Record<string, any>
  ? (typeof ROUTES)[T] extends { _: infer U }
  ? U
  : never
  : never
  : never;

type ExtractParams<T extends string> = T extends `${string}:${infer Param}/${infer Rest}`
  ? { [K in Param]: string } & ExtractParams<Rest>
  : T extends `${string}:${infer Param}`
  ? { [K in Param]: string }
  : {};

export function route<T extends RouteName>(
  path: T,
  ...args: IsEmptyObject<RouteParams<T>> extends true ? [] : [params: RouteParams<T>]
): string {
  const keys = path.split('.');
  let current: any = ROUTES;

  for (const key of keys) {
    current = current[key];
  }

  if (current === undefined) {
    console.error(`Route "${path}" not found`);

    return '';
  }

  const routePath = typeof current === 'string' ? current : current._;
  const params = args[0];

  if (params) {
    return Object.entries(params).reduce((acc, [key, value]) => acc.replace(`:${key}`, String(value)), routePath);
  }

  return routePath;
}

function routePath<T extends RouteName>(path: T): GetRoutePath<T> {
  const keys = path.split('.');
  let current: any = ROUTES;

  for (const key of keys) {
    current = current[key];
  }

  return (typeof current === 'string' ? current : current._) as GetRoutePath<T>;
}

function relativeRoutePath<T extends RouteName>(path: T, basePath: RouteName): string {
  const fullPath = routePath(path);
  const base = routePath(basePath);

  if (fullPath.startsWith(base)) {
    return fullPath.slice(base.length).replace(/^\//, '') || '.';
  }

  return fullPath;
}

const LoginRoute = () => {
  const { fullyAuthenticated, privyAuthenticated, authFailed } = useAuth();

  if (fullyAuthenticated) {
    return <Navigate to={routePath('dashboard')} replace />;
  }

  // Only redirect to mint if privy authenticated and auth hasn't failed
  if (privyAuthenticated && !authFailed) {
    return <Navigate to={routePath('mint')} replace />;
  }

  return <Outlet />;
};

const ProtectedRoute = () => {
  // @TODO useAuth changed - test behaviour
  const { privyAuthenticated, authFailed } = useAuth();

  // If auth failed, redirect to login page
  if (authFailed) {
    return <Navigate to={routePath('login')} replace />;
  }

  if (!privyAuthenticated) {
    return <Navigate to={routePath('login')} replace />;
  }

  return <Outlet />;
};

const RequiresMintRoute = () => {
  // @TODO useAuth changed - test behaviour
  const { wsAuthenticated, fullyAuthenticated, privyAuthenticated, authFailed } = useAuth();

  if (!privyAuthenticated) {
    return null;
  }

  // If auth failed, redirect to login page
  if (authFailed) {
    return <Navigate to={routePath('login')} replace />;
  }

  if (wsAuthenticated && !fullyAuthenticated && !authFailed) {
    return <Navigate to={routePath('mint')} replace />;
  }

  return <Outlet />;
};

const AppRoutes = () => {
  // @TODO useAuth changed - test behaviour
  const { fullyAuthenticated, privyAuthenticated, authFailed } = useAuth();

  return (
    <Routes>
      {/* Login route */}
      <Route element={<LoginRoute />}>
        <Route path={routePath('login')} element={<AuthLayout />}>
          <Route index element={<LoginPage />} />
        </Route>
      </Route>

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RequiresMintRoute />}>
          <Route element={<BlockStateWrapper />}>
            <Route path={routePath('profile')}>
              <Route element={<DashboardLayout bottomNavigationType="profile" />}>
                <Route index element={<ProfilePage />} />
              </Route>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route path={relativeRoutePath('profile.world', 'profile')} element={<WorldIDPage />} />
                <Route path={relativeRoutePath('profile.history', 'profile')} element={<TransactionHistoryPage />} />
                <Route path={relativeRoutePath('profile.transfer', 'profile')} element={<TransferPage />} />
                <Route path={relativeRoutePath('profile.withdraw', 'profile')} element={<WithdrawPage />} />
                <Route path={relativeRoutePath('profile.atm', 'profile')} element={<ATMPage />} />
              </Route>
              <Route element={<CloudSitLayout />}>
                <Route path={relativeRoutePath('profile.transaction', 'profile')} element={<TransactionPage />} />
              </Route>
            </Route>

            <Route path={routePath('dashboard')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<DashboardPage />} />
              </Route>
            </Route>

            <Route path={routePath('notifications')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<NotificationsPage />} />
                <Route
                  path={relativeRoutePath('notifications.show', 'notifications')}
                  element={<NotificationDetailsPage />}
                />
              </Route>
            </Route>

            <Route path={routePath('bathroom')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<PlaceBathroomPage />} />
              </Route>
            </Route>

            <Route path={routePath('bedroom')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<PlaceBedroomPage />} />
              </Route>
            </Route>

            <Route path={routePath('dead')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<DeadPage />} />
              </Route>
            </Route>

            <Route path={routePath('ai_terminal')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<PlaceAITerminalPage />} />
              </Route>
            </Route>

            <Route path={routePath('wall_street')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<PlaceWallStreetPage />} />
              </Route>
            </Route>

            <Route path={routePath('hotel')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<HotelPage />} />
                <Route path={relativeRoutePath('hotel.active', 'hotel')} element={<HotelActivePage />} />
                <Route path={relativeRoutePath('hotel.bought', 'hotel')} element={<HotelBoughtPage />} />
                <Route path={relativeRoutePath('hotel.rooms', 'hotel')} element={<HotelRoomsPage />} />
              </Route>
            </Route>

            <Route path={routePath('guild')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<GuildPage />} />
                <Route path={relativeRoutePath('guild.show', 'guild')} element={<GuildDetailsPage />} />
                <Route path={relativeRoutePath('guild.settings', 'guild')} element={<GuildSettingsPage />} />
              </Route>
            </Route>

            <Route path={routePath('artwork')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<ArtWorkPage />} />
              </Route>
            </Route>

            <Route path={routePath('cookie_jar')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<CookieJarPage />} />
                <Route
                  path={relativeRoutePath('cookie_jar.current', 'cookie_jar')}
                  element={<CookieJarCurrentStakingPage />}
                />
              </Route>
            </Route>

            <Route path={routePath('office')}>
              <Route element={<DashboardLayout bottomNavigation={false} />}>
                <Route index element={<OfficePage />} />
              </Route>
            </Route>

            <Route path={routePath('game')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<GamesPage />} />
                <Route path={relativeRoutePath('game.doors', 'game')} element={<GameDoorsPage />} />
                <Route path={relativeRoutePath('game.dices', 'game')} element={<GameDicesPage />} />
                <Route path={relativeRoutePath('game.king_of_the_hill', 'game')} element={<GameKingOfTheHillPage />} />
                <Route path={relativeRoutePath('game.wordle', 'game')} element={<GameWordlePage />} />
                <Route path={relativeRoutePath('game.slots', 'game')} element={<GameSlotsPage />} />
                <Route path={relativeRoutePath('game.throw_ball', 'game')} element={<GameThrowBallPage />} />
                <Route path={relativeRoutePath('game.poker', 'game')} element={<GamePokerPage />} />
              </Route>
            </Route>

            <Route path={routePath('journey')}>
              <Route element={<DashboardLayout bottomNavigationType="journey" />}>
                <Route index element={<JourneyPage />} />
                <Route
                  path={relativeRoutePath('journey.achievements', 'journey')}
                  element={<JourneyAchievementsPage />}
                />
                <Route path={relativeRoutePath('journey.history', 'journey')} element={<JourneyHistoryPage />} />
              </Route>
            </Route>

            <Route path={routePath('store')}>
              <Route element={<DashboardLayout bottomNavigationType="store" />}>
                <Route index element={<StorePage />} />
                <Route path={relativeRoutePath('store.group', 'store')} element={<StoreGroupPage />} />
              </Route>
            </Route>

            <Route path={routePath('inventory')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<InventoryPage />} />
                <Route path={relativeRoutePath('inventory.group', 'inventory')} element={<InventoryGroupPage />} />
              </Route>
            </Route>

            <Route path={routePath('kitchen')}>
              <Route element={<DashboardLayout bottomNavigationType="kitchen" />}>
                <Route index element={<KitchenPage />} />
                <Route path={relativeRoutePath('kitchen.fridge', 'kitchen')} element={<KitchenFridgePage />} />
                <Route path={relativeRoutePath('kitchen.grocery', 'kitchen')} element={<KitchenGroceryPage />} />
              </Route>
            </Route>

            <Route path={routePath('prediction')}>
              <Route element={<DashboardLayout />}>
                <Route index element={<PredictionPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route element={<MintLayout />}>
          <Route
            path={routePath('mint')}
            element={fullyAuthenticated ? <Navigate to={routePath('dashboard')} replace /> : <MintPage />}
          />
        </Route>

        <Route path={routePath('pet')}>
          <Route element={<DashboardLayout bottomNavigation={false} />}>
            <Route
              path={relativeRoutePath('pet.personalize', 'pet')}
              element={fullyAuthenticated ? <Navigate to={routePath('dashboard')} replace /> : <PetPersonalizePage />}
            />
            <Route path={relativeRoutePath('pet.personality', 'pet')} element={<PetPersonalityPage />} />
          </Route>
        </Route>

        <Route path={routePath('referrals')}>
          <Route element={<DashboardLayout bottomNavigation={false} />}>
            <Route index element={<ReferralsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Redirect root to dashboard if authenticated, otherwise to login */}
      <Route
        path="/"
        element={
          <Navigate
            to={
              fullyAuthenticated
                ? routePath('dashboard')
                : (privyAuthenticated && !authFailed)
                  ? routePath('mint')
                  : routePath('login')
            }
            replace
          />
        }
      />

      {/* Catch all route - redirect to dashboard or login based on authentication */}
      <Route
        path="*"
        element={
          <Navigate
            to={
              fullyAuthenticated
                ? routePath('dashboard')
                : (privyAuthenticated && !authFailed)
                  ? routePath('mint')
                  : routePath('login')
            }
            replace
          />
        }
      />
    </Routes>
  );
};

export default AppRoutes;