import React, { createContext, ReactNode, useCallback, useContext, useState, useEffect } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketConsumableKitchen, WebSocketConsumableUser } from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import { Collection } from '@utils/collection';
import { CONFIG } from '@/constants';

export enum KitchenConsumableBlueprintID {
  BURGER = 'BURGER',
  SALAD = 'SALAD',
  STEAK = 'STEAK',
  COOKIE = 'COOKIE',
  PIZZA = 'PIZZA',
  SUSHI = 'SUSHI',
  ENERGIZER = 'ENERGIZER',
  SMALL_POTION = 'SMALL_POTION',
  LARGE_POTION = 'LARGE_POTION',
  POTION = 'POTION',
  XP_POTION = 'XP_POTION',
  SUPER_XP_POTION = 'SUPER_XP_POTION',
  REVIVE_POTION = 'REVIVE_POTION',
}

export interface IKitchenConsumable {
  blueprintID: KitchenConsumableBlueprintID;
  displayName: string;

  name: string;
  btnName: string;
  description: string;
  type: string;
  basePrice?: string;
  ethPrice?: string;
  health?: number;
  happiness?: number;
  hunger?: number;
  energy?: number;
  cleanliness?: number;
  duration: number;
  showInShop: boolean;
  effects: [];
  computedTokenPrice?: string;
  computedEthOrSolanaPrice?: string;
}

export interface IKitchenOwnedConsumable extends IKitchenConsumable {
  quantity: number;
  timeExpired: string | null;
}

class GroceryConsumables extends Collection<IKitchenConsumable> {
  getByBlueprintID(blueprintID: KitchenConsumableBlueprintID) {
    return this.find(consumable => consumable.blueprintID === blueprintID);
  }
}

class Consumables extends Collection<IKitchenOwnedConsumable> {}

interface IKitchenContext {
  loading: boolean;
  loadingBuy: boolean;

  groceryConsumables: GroceryConsumables;
  groceryConsumablesHasLoadedOnce: boolean;
  loadGroceryConsumables: () => Promise<GroceryConsumables | void>;

  consumables: Consumables;
  consumablesHasLoadedOnce: boolean;
  loadConsumables: () => Promise<Consumables | void>;

  buy: (id: string, amount: number) => Promise<void>;
  use: (id: string) => Promise<void>;
}

const makeConsumableObject = (data: WebSocketConsumableKitchen) => {
  return {
    blueprintID: data.blueprintID,
    displayName: data.blueprint.name,
    computedTokenPrice: data.computedTokenPrice,
    computedEthOrSolanaPrice: data.computedEthOrSolanaPrice,
    ...data.blueprint,
  } as IKitchenConsumable;
};

const makeConsumableOwnedObject = (data: WebSocketConsumableUser, consumable: IKitchenConsumable) => {
  return {
    ...consumable,
    ...data,
  } as IKitchenOwnedConsumable;
};

const KitchenContext = createContext<IKitchenContext | undefined>(undefined);

export const KitchenProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { consumablesBuy, consumablesGet, consumablesUse, kitchenGet } = useWebSocketMessenger();
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingBuy, setLoadingBuy] = useState<boolean>(false);

  const [groceryConsumables, setGroceryConsumables] = useState<GroceryConsumables>(new GroceryConsumables([]));
  const [groceryConsumablesHasLoadedOnce, setGroceryConsumablesHasLoadedOnce] = useState<boolean>(false);

  const [consumables, setConsumables] = useState<Consumables>(new Consumables([]));
  const [consumablesHasLoadedOnce, setConsumablesHasLoadedOnce] = useState<boolean>(false);

  const fetchGroceryConsumables = useCallback(async () => {
    const response = await withSafeRetry(() => kitchenGet());

    if (!response || response.error || !response.data?.consumables) {
      throw new Error(response?.error || 'Failed to load grocery consumables');
    }

    return response;
  }, [kitchenGet]);

  const throttleFetchGroceryConsumables = useThrottle(fetchGroceryConsumables, { time: CONFIG.THROTTLE.TIME_API });

  const loadGroceryConsumables = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchGroceryConsumables() : throttleFetchGroceryConsumables.force());

        const newGroceryConsumables = new GroceryConsumables(
          response.data.consumables.map(data => makeConsumableObject(data)),
        );

        setGroceryConsumables(newGroceryConsumables);
        setGroceryConsumablesHasLoadedOnce(true);
        setLoading(false);

        return newGroceryConsumables;
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchGroceryConsumables],
  );

  const fetchConsumables = useCallback(async () => {
    const response = await withSafeRetry(() => consumablesGet());

    if (!response || response.error || !response.data?.consumables) {
      throw new Error(response?.error || 'Failed to load consumables');
    }

    return response;
  }, [consumablesGet]);

  const throttleFetchConsumables = useThrottle(fetchConsumables, { time: CONFIG.THROTTLE.TIME_API });

  const loadConsumables = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const groceryConsumables = await loadGroceryConsumables();

        if (!groceryConsumables) {
          throw new Error('Failed to load grocery consumables for blueprints');
        }

        const response = await (throttle ? throttleFetchConsumables() : throttleFetchConsumables.force());

        const newConsumables = new Consumables(
          response.data.consumables
            .filter(data => data.quantity > 0)
            .map(data => {
              const consumable = groceryConsumables.getByBlueprintID(data.blueprint as KitchenConsumableBlueprintID);

              if (!consumable) {
                throw new Error(`Failed to get consumable for ${data.blueprint}`);
              }

              return makeConsumableOwnedObject(data, consumable);
            }),
        );

        setConsumables(newConsumables);
        setConsumablesHasLoadedOnce(true);
        setLoading(false);

        return newConsumables;
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchConsumables, loadGroceryConsumables],
  );

  const buy = useCallback(
    async (id: string, amount: number) => {
      setLoadingBuy(true);
      const response = await withSafeRetry(() => consumablesBuy(id, amount));

      if (response?.error) {
        throw new Error(response?.error || 'Failed to buy consumables');
      }

      await loadConsumables(false);
      setLoadingBuy(false);
    },
    [consumablesBuy, loadConsumables],
  );

  const use = useCallback(
    async (id: string) => {
      const response = await withSafeRetry(() => consumablesUse(id));

      if (response?.error) {
        throw new Error(response?.error || 'Failed to use consumables');
      }

      await loadConsumables(false);
    },
    [consumablesUse, loadConsumables],
  );

  useEffect(() => {
    loadConsumables().catch(e => {
      console.error('Failed to load consumables on startup:', e);
    });
  }, [loadConsumables]);

  return (
    <KitchenContext.Provider
      value={{
        loading,
        loadingBuy,

        groceryConsumables,
        groceryConsumablesHasLoadedOnce,
        loadGroceryConsumables,

        consumables,
        consumablesHasLoadedOnce,
        loadConsumables,

        buy,
        use,
      }}
    >
      {children}
    </KitchenContext.Provider>
  );
};

export const useKitchen = (): IKitchenContext => {
  const context = useContext(KitchenContext);

  if (context === undefined) {
    throw new Error('useKitchen must be used within a KitchenProvider');
  }

  return context;
};
