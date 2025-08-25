import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { TraitThresholds, WebSocketPetStats, WebSocketPetTokens } from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import { Collection } from '@utils/collection';
import moment from 'moment/moment';
import { CONFIG } from '@/constants';

export interface IPet {
  id: string;
  name: string;
  userID: string;
  sleeping: boolean;
  dead: boolean;
  god: boolean;
  active: boolean;
  currentHotelTier: number;
  deadTime: moment.Moment | null;
  inRiskOfDeathTime: moment.Moment | null;
  PetTokens: WebSocketPetTokens;
  PetStats: WebSocketPetStats;
}

export enum PetTraitType {
  Artist = 'artist',
  Athletic = 'athletic',
  Competitive = 'competitive',
  Curious = 'curious',
  Degenerate = 'degenerate',
  Fashionable = 'fashionable',
  GamblingAddict = 'gambling_addict',
  Geek = 'geek',
  Gluttonous = 'gluttonous',
  Hygienic = 'hygienic',
  Lazy = 'lazy',
  Magnate = 'magnate',
  Npc = 'npc',
  Social = 'social',
  Storyteller = 'storyteller',
}

export interface IPetTrait {
  type: PetTraitType;
  value: number;
  name: string;
  description: string;
}

interface IPetPersonality {
  dominantTrait: PetTraitType;
  traits: PetTraits;
}

class PetTraits extends Collection<IPetTrait> {
  getByType(type: PetTraitType): IPetTrait | undefined {
    return this.find(trait => trait.type === type);
  }
}

export class Pets extends Collection<IPet> {
  getByName(name: string): IPet | undefined {
    return this.find(pet => pet.name.toLowerCase() === name.toLowerCase());
  }
}

export interface IPetContext {
  loading: boolean;

  personality: IPetPersonality;
  personalityHasLoadedOnce: boolean;
  loadPersonality: () => Promise<void>;
}

const PetContext = createContext<IPetContext | undefined>(undefined);

export const PetProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { personalityGet } = useWebSocketMessenger();

  const [loading, setLoading] = useState<boolean>(false);

  const [allPersonalities, setAllPersonalities] = useState<TraitThresholds>({} as TraitThresholds);
  const [personality, setPersonality] = useState<IPetPersonality>({} as IPetPersonality);
  const [personalityHasLoadedOnce, setPersonalityHasLoadedOnce] = useState<boolean>(false);

  const fetchPersonality = useCallback(async () => {
    const response = await withSafeRetry(() => personalityGet());

    if (!response || response.error || !response.data?.personality) {
      throw new Error(response?.error || 'Failed to load pet personality');
    }

    return response;
  }, [personalityGet]);

  const throttleFetchPersonality = useThrottle(fetchPersonality, { time: CONFIG.THROTTLE.TIME_API });

  const loadPersonality = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchPersonality() : throttleFetchPersonality.force());

        const traits = new PetTraits(
          Object.keys(response.data.personality?.traits || []).map(key => {
            const type = key as PetTraitType;

            return {
              type: type,
              value: response.data.personality?.traits[type] || 0,
              name: type.toLowerCase().substring(0, 1).toUpperCase() + type.toLowerCase().substring(1),
              description: allPersonalities[type]?.description || 'Mistery trait',
            };
          }),
        );

        setAllPersonalities(response.data.allPersonalities);

        setPersonality({
          dominantTrait: response.data.personality?.dominantTrait as PetTraitType,
          traits: traits,
        });
        setPersonalityHasLoadedOnce(true);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchPersonality, allPersonalities],
  );

  return (
    <PetContext.Provider
      value={{
        loading,

        personality,
        personalityHasLoadedOnce,
        loadPersonality,
      }}
    >
      {children}
    </PetContext.Provider>
  );
};

export const usePet = (): IPetContext => {
  const context = useContext(PetContext);

  if (context === undefined) {
    throw new Error('usePet must be used within a PetProvider');
  }

  return context;
};
