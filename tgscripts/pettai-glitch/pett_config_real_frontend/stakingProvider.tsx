import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketMessageDataStakingType } from '@interfaces/WebSocketMessage';
import { StakingID, WebSocketStakingBlueprint } from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import { Collection } from '@utils/collection';
import { Token } from '@utils/token';
import moment from 'moment/moment';
import { CONFIG } from '@/constants';

export interface IStaking {
  type: StakingID;
  id: string;
  petID: string;
  amount: Token;
  startedAt: moment.Moment;
  finishedAt: moment.Moment;
  lastClaim: string | null;
}

class Stakes extends Collection<IStaking> {
  get total(): Token {
    let total = 0n;

    this.items.forEach(item => (total += item.amount.amount));

    return new Token(total);
  }
}

export interface IStakingContext {
  loading: boolean;

  stakes: Stakes;
  stakesHasLoadedOnce: boolean;
  loadStakes: () => Promise<void>;

  blueprints: Map<StakingID, WebSocketStakingBlueprint>;
  blueprintsHasLoadedOnce: boolean;
  loadBlueprints: () => Promise<void>;

  create: (type: WebSocketMessageDataStakingType, amount: bigint) => Promise<void>;
  redeem: (stakingId: string) => Promise<void>;
}

const StakingContext = createContext<IStakingContext | undefined>(undefined);

export const StakingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { stakingCreate, stakingGet, stakingBlueprints, stakingClaim } = useWebSocketMessenger();

  const [loading, setLoading] = useState<boolean>(false);

  const [stakes, setStakes] = useState<Stakes>(new Stakes([]));
  const [stakesHasLoadedOnce, setStakesHasLoadedOnce] = useState<boolean>(false);

  const [blueprints, setBlueprints] = useState<Map<StakingID, WebSocketStakingBlueprint>>(new Map());
  const [blueprintsHasLoadedOnce, setBlueprintsHasLoadedOnce] = useState<boolean>(false);

  const fetchStakes = useCallback(async () => {
    const response = await withSafeRetry(() => stakingGet());

    if (!response || response.error || !response.data?.staking) {
      throw new Error(response?.error || 'Failed to load staking');
    }

    return response;
  }, [stakingGet]);

  const fetchBlueprints = useCallback(async () => {
    const response = await withSafeRetry(() => stakingBlueprints());

    if (!response || response.error || !response.data?.blueprints) {
      throw new Error(response?.error || 'Failed to load staking blueprints');
    }

    return response;
  }, [stakingBlueprints]);

  const throttleFetchStakes = useThrottle(fetchStakes, { time: CONFIG.THROTTLE.TIME_API });
  const throttleFetchBlueprints = useThrottle(fetchBlueprints, { time: CONFIG.THROTTLE.TIME_API });

  const loadStakes = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchStakes() : throttleFetchStakes.force());

        const newStaking = new Stakes(
          response.data.staking.map(staking => {
            return {
              ...staking,
              type: staking.type,
              amount: new Token(BigInt(staking.amount)),
              startedAt: moment(staking.startedAt),
              finishedAt: moment(staking.finishedAt),
            } as IStaking;
          }),
        );

        setStakes(newStaking);
        setStakesHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchStakes],
  );

  const loadBlueprints = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchBlueprints() : throttleFetchBlueprints.force());

        // Convert the object response to a proper Map
        const blueprintsMap = new Map<StakingID, WebSocketStakingBlueprint>();

        if (response.data.blueprints) {
          Object.entries(response.data.blueprints).forEach(([key, value]) => {
            blueprintsMap.set(key as StakingID, { ...value, apy: value.apy * 100 } as WebSocketStakingBlueprint);
          });
        }

        setBlueprints(blueprintsMap);
        setBlueprintsHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchBlueprints],
  );

  const create = useCallback(
    async (type: WebSocketMessageDataStakingType, amount: bigint) => {
      const response = await withSafeRetry(() => stakingCreate(type, amount.toString()));

      if (!response || response.error || !response.data?.staking) {
        throw new Error(response?.error || 'Failed to create staking');
      }
    },
    [stakingCreate],
  );

  const redeem = useCallback(
    async (stakingId: string) => {
      const response = await withSafeRetry(() => stakingClaim(stakingId));

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to redeem staking');
      }

      // Reload stakes after successful redemption
      await loadStakes(false);
    },
    [stakingClaim, loadStakes],
  );

  useEffect(() => {
    if (!blueprintsHasLoadedOnce) {
      loadBlueprints(false);
    }
  }, [loadBlueprints, blueprintsHasLoadedOnce]);

  useEffect(() => {
    if (!stakesHasLoadedOnce) {
      loadStakes(false);
    }
  }, [loadStakes, stakesHasLoadedOnce]);

  return (
    <StakingContext.Provider
      value={{
        loading,

        stakes,
        stakesHasLoadedOnce,
        loadStakes,

        blueprints,
        blueprintsHasLoadedOnce,
        loadBlueprints,

        create,
        redeem,
      }}
    >
      {children}
    </StakingContext.Provider>
  );
};

export const useStaking = (): IStakingContext => {
  const context = useContext(StakingContext);

  if (context === undefined) {
    throw new Error('useStaking must be used within a StakingProvider');
  }

  return context;
};
