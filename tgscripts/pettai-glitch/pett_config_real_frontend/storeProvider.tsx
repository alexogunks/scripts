import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketAccessoryMall, WebSocketAccessoryUser } from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import moment from 'moment/moment';
import { CONFIG } from '@/constants';

export type StoreAccessoryType = 'head' | 'handheld' | 'wings' | 'toy' | 'special';
export type StoreAccessoryEffectType =
  | 'BONUS_XP'
  | 'BONUS_TOKENS'
  | 'BONUS_HEALTH'
  | 'BONUS_ENERGY'
  | 'BONUS_HAPPINESS'
  | 'BONUS_HUNGER'
  | 'BONUS_HYGIENE';

export enum StoreAccessoryBlueprintID {
  // FOR PREVIEW
  NONE = 'NONE',

  // HEAD
  CROWN = 'CROWN',
  HALO = 'HALO',
  DEVIL_HORNS = 'DEVIL_HORNS',
  UNICORN_HORN = 'UNICORN_HORN',
  PARTY_HAT = 'PARTY_HAT',
  MUSHROOMS = 'MUSHROOMS',
  STEM = 'STEM',
  BEANIE_BEIJE = 'BEANIE_BEIJE',
  CAP_GREEN = 'CAP_GREEN',
  SAMURAI_HELMET = 'SAMURAI_HELMET',

  // HELD
  BALLOON_ETH = 'BALLOON_ETH',
  BALLOON_BASE = 'BALLOON_BASE',
  BALLOON_BASE_WHITE = 'BALLOON_BASE_WHITE',
  BALLOON_BTC = 'BALLOON_BTC',
  KITE_BLUE = 'KITE_BLUE',
  RACKET_PADEL = 'RACKET_PADEL',
  BALLOON_RED = 'BALLOON_RED',

  // BACK
  WINGS_ANGEL = 'WINGS_ANGEL',
  WINGS_DEVIL = 'WINGS_DEVIL',
  WINGS_FAIRY = 'WINGS_FAIRY',
  WINGS_BAT = 'WINGS_BAT',

  // TOY
  TOY_BULL = 'TOY_BULL',
  TOY_BEAR = 'TOY_BEAR',
  TOY_FROG = 'TOY_FROG',
  TOY_CRAB = 'TOY_CRAB',
  WORLD_ID = 'WORLD_ID',

  // SPECIAL
  CAP_DS = 'CAP_DS',
  HALLOWEEN = 'HALLOWEEN',
  IVAN_ON_TECH = 'IVAN_ON_TECH',
  BEANIE_MOCHI = 'BEANIE_MOCHI',
  CAP_PAAL = 'CAP_PAAL',
  BEANIE_DIAMOND = 'BEANIE_DIAMOND',
  HAT_AFRICA = 'HAT_AFRICA',
  BEANIE_NEIRO = 'BEANIE_NEIRO',
  HAT_CHINA = 'HAT_CHINA',
  GOGGLES_MILITARY = 'GOGGLES_MILITARY',
  HAT_ELF = 'HAT_ELF',
  HAT_SANTA = 'HAT_SANTA',
  HAT_THANKSGIVING = 'HAT_THANKSGIVING',
  PARTY_HAT_NEW_YEARS = 'PARTY_HAT_NEW_YEARS',
  VEST_PATAGONIA = 'VEST_PATAGONIA',
  ROBE_SECRET = 'ROBE_SECRET',
}

export type StoreAccessoryHeadID =
  | StoreAccessoryBlueprintID.NONE
  | StoreAccessoryBlueprintID.CROWN
  | StoreAccessoryBlueprintID.HALO
  | StoreAccessoryBlueprintID.DEVIL_HORNS
  | StoreAccessoryBlueprintID.UNICORN_HORN
  | StoreAccessoryBlueprintID.PARTY_HAT
  | StoreAccessoryBlueprintID.MUSHROOMS
  | StoreAccessoryBlueprintID.STEM
  | StoreAccessoryBlueprintID.BEANIE_BEIJE
  | StoreAccessoryBlueprintID.CAP_GREEN
  | StoreAccessoryBlueprintID.SAMURAI_HELMET;

export type StoreAccessoryHeldID =
  | StoreAccessoryBlueprintID.NONE
  | StoreAccessoryBlueprintID.BALLOON_ETH
  | StoreAccessoryBlueprintID.BALLOON_BASE
  | StoreAccessoryBlueprintID.BALLOON_BTC
  | StoreAccessoryBlueprintID.KITE_BLUE
  | StoreAccessoryBlueprintID.RACKET_PADEL
  | StoreAccessoryBlueprintID.BALLOON_RED;

export type StoreAccessoryBackID =
  | StoreAccessoryBlueprintID.NONE
  | StoreAccessoryBlueprintID.WINGS_ANGEL
  | StoreAccessoryBlueprintID.WINGS_DEVIL
  | StoreAccessoryBlueprintID.WINGS_FAIRY
  | StoreAccessoryBlueprintID.WINGS_BAT;

export type StoreAccessoryToyID =
  | StoreAccessoryBlueprintID.NONE
  | StoreAccessoryBlueprintID.TOY_BULL
  | StoreAccessoryBlueprintID.TOY_BEAR
  | StoreAccessoryBlueprintID.TOY_FROG
  | StoreAccessoryBlueprintID.TOY_CRAB
  | StoreAccessoryBlueprintID.WORLD_ID;

export type StoreAccessorySpecialID =
  | StoreAccessoryBlueprintID.NONE
  | StoreAccessoryBlueprintID.CAP_DS
  | StoreAccessoryBlueprintID.HALLOWEEN
  | StoreAccessoryBlueprintID.IVAN_ON_TECH
  | StoreAccessoryBlueprintID.BEANIE_MOCHI
  | StoreAccessoryBlueprintID.CAP_PAAL
  | StoreAccessoryBlueprintID.BEANIE_DIAMOND
  | StoreAccessoryBlueprintID.HAT_AFRICA
  | StoreAccessoryBlueprintID.BEANIE_NEIRO
  | StoreAccessoryBlueprintID.HAT_CHINA
  | StoreAccessoryBlueprintID.GOGGLES_MILITARY
  | StoreAccessoryBlueprintID.HAT_ELF
  | StoreAccessoryBlueprintID.HAT_SANTA
  | StoreAccessoryBlueprintID.HAT_THANKSGIVING
  | StoreAccessoryBlueprintID.PARTY_HAT_NEW_YEARS
  | StoreAccessoryBlueprintID.VEST_PATAGONIA
  | StoreAccessoryBlueprintID.ROBE_SECRET;

export interface IStoreAccessoryEffect {
  tag: StoreAccessoryEffectType;
  lowerBound: number;
  upperBound: number;
}

export interface IStoreAccessory {
  blueprintID: StoreAccessoryBlueprintID;
  type: StoreAccessoryType;
  name: string;
  basePrice?: bigint;
  computedTokenPrice?: bigint;
  effects: IStoreAccessoryEffect[];
  description: string;
  imageURL: string;
  tier: string;
}

export interface IStoreUserAccessory extends IStoreAccessory {
  id: string;
  petId: string;
  equipped: boolean;
  rating: number;
  obtainedAt: moment.Moment;
}

export interface IStoreContext {
  accessories: {
    shop: IStoreAccessory[];
    owned: IStoreUserAccessory[];
    equipped: IStoreUserAccessory[];
  } | null;
  loadingAccessories: boolean;
  accessoriesHasLoadedOnce: boolean;
  loadAccessories: () => Promise<void>;

  buy: (blueprintID: StoreAccessoryBlueprintID) => Promise<boolean>;
  use: (blueprintID: StoreAccessoryBlueprintID) => Promise<boolean>;
}

const StoreContext = createContext<IStoreContext | undefined>(undefined);

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { mallGet, accessoryBuy, accessoryUse } = useWebSocketMessenger();

  const [accessoriesHasLoadedOnce, setAccessoriesHasLoadedOnce] = useState<boolean>(false);
  const [accessories, setAccessoriesState] = useState<{
    shop: IStoreAccessory[];
    owned: IStoreUserAccessory[];
    equipped: IStoreUserAccessory[];
  } | null>(null);

  const [loadingAccessories, setLoadingAccessories] = useState<boolean>(false);

  const setShopAccessories = useCallback((shop: IStoreAccessory[]) => {
    setAccessoriesState(prev => ({ ...(prev || { shop: [], owned: [], equipped: [] }), shop }));
  }, []);

  const setOwnedAccessories = useCallback((owned: IStoreUserAccessory[]) => {
    setAccessoriesState(prev => ({ ...(prev || { shop: [], owned: [], equipped: [] }), owned }));
  }, []);

  const setEquippedAccessories = useCallback((equipped: IStoreUserAccessory[]) => {
    setAccessoriesState(prev => ({ ...(prev || { shop: [], owned: [], equipped: [] }), equipped }));
  }, []);

  const fetchAccessories = useCallback(async () => {
    const response = await withSafeRetry(() => mallGet());

    if (!response || response.error || !response.data?.allAccessories) {
      throw new Error(response?.error || 'Failed to load accessories');
    }

    return response;
  }, [mallGet]);

  const throttleFetchAccessories = useThrottle(fetchAccessories, { time: CONFIG.THROTTLE.TIME_API });

  const loadAccessories = useCallback(
    async (throttle = true) => {
      setLoadingAccessories(true);

      try {
        const response = await (throttle ? throttleFetchAccessories() : throttleFetchAccessories.force());

        const shopAccessories =
          response.data.allAccessories.map((res: WebSocketAccessoryMall) => {
            const accessory = res.blueprint as IStoreAccessory;
            accessory.blueprintID = res.blueprintID as StoreAccessoryBlueprintID;
            accessory.basePrice = res.blueprint.basePrice ? BigInt(res.blueprint.basePrice) : undefined;
            accessory.computedTokenPrice = res.computedTokenPrice ? BigInt(res.computedTokenPrice) : undefined;

            return accessory;
          }) || [];

        setShopAccessories(shopAccessories);

        const ownedAccessories =
          response.data.ownedAccessories?.map((res: WebSocketAccessoryUser) => {
            const shopAccessory = shopAccessories.find(item => item.blueprintID === res.blueprint);
            const userAccessory = shopAccessory as IStoreUserAccessory;

            userAccessory.id = res.id;
            userAccessory.petId = res.petID;
            userAccessory.rating = res.rating;
            userAccessory.equipped = res.equipped;
            userAccessory.obtainedAt = moment(res.obtainedDate);

            return userAccessory;
          }) || [];
        const equippedAccessories = ownedAccessories.filter(accessory => accessory.equipped);

        setOwnedAccessories(ownedAccessories);
        setEquippedAccessories(equippedAccessories);
        setAccessoriesHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoadingAccessories(false);
    },
    [throttleFetchAccessories, setOwnedAccessories, setEquippedAccessories, setShopAccessories],
  );

  const buy = useCallback(
    async (blueprintID: string) => {
      const response = await withSafeRetry(() => accessoryBuy(blueprintID));

      if (!response || response?.error) {
        throw new Error(response?.error || 'Failed to buy accessory');
      }

      await loadAccessories(false);

      return true;
    },
    [accessoryBuy, loadAccessories],
  );

  const use = useCallback(
    async (blueprintID: string) => {
      setLoadingAccessories(true);

      try {
        const response = await withSafeRetry(() => accessoryUse(blueprintID));

        if (!response || response?.error) {
          throw new Error(response?.error || 'Failed to use accessory');
        }

        await loadAccessories(false);

        return true;
      } finally {
        setLoadingAccessories(false);
      }
    },
    [accessoryUse, loadAccessories],
  );

  // Load accessories on mount
  useEffect(() => {
    if (!accessoriesHasLoadedOnce) {
      loadAccessories(false);
    }
  }, [loadAccessories, accessoriesHasLoadedOnce]);

  return (
    <StoreContext.Provider
      value={{
        accessories,
        loadingAccessories,
        accessoriesHasLoadedOnce,
        loadAccessories,

        buy,
        use,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): IStoreContext => {
  const context = useContext(StoreContext);

  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }

  return context;
};
