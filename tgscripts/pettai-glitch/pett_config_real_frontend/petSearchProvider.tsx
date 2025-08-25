import React, { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { IPet, Pets } from '@providers/PetProvider';
import { withSafeRetry } from '@utils/async';
import moment from 'moment/moment';
import { CONFIG } from '@/constants';

export interface IPetSearchContext {
  loading: boolean;

  currentSearchQuery: string;
  currentSearchPets: Pets;
  currentSearchPetsHasLoaded: boolean;
  loadCurrentSearchPets: (name: string) => Promise<Pets>;
}

const PetSearchContext = createContext<IPetSearchContext | undefined>(undefined);

export const PetSearchProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { petSearch } = useWebSocketMessenger();

  const [loading, setLoading] = useState<boolean>(false);

  const [currentSearchQuery, setCurrentSearchQuery] = useState<string>('');
  const [currentSearchPets, setCurrentSearchPets] = useState<Pets>(new Pets());
  const [currentSearchPetsHasLoaded, setCurrentSearchPetsHasLoaded] = useState<boolean>(false);

  const fetchCurrentSearchPets = useCallback(
    async (name: string) => {
      const response = await withSafeRetry(() => petSearch(name));

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to load search pets');
      }

      return response;
    },
    [petSearch],
  );

  const throttleFetchCurrentSearchPets = useThrottle(fetchCurrentSearchPets, { time: CONFIG.THROTTLE.TIME_API });

  const loadCurrentSearchPets = useCallback(
    async (name: string, throttle = true) => {
      setLoading(true);
      setCurrentSearchPetsHasLoaded(false);
      setCurrentSearchQuery(name);

      try {
        const response = await (throttle
          ? throttleFetchCurrentSearchPets(name)
          : throttleFetchCurrentSearchPets.force(name));

        const newSearchPets = new Pets(
          response.data.pets.map(pet => {
            return {
              ...pet,
              deadTime: pet.deadTime ? moment(pet.deadTime) : null,
              inRiskOfDeathTime: pet.inRiskOfDeathTime ? moment(pet.inRiskOfDeathTime) : null,
            } as IPet;
          }),
        );

        setCurrentSearchPets(newSearchPets);
        setCurrentSearchPetsHasLoaded(true);
        setLoading(false);

        return newSearchPets;
      } catch (e) {
        console.error(e);
      }

      setCurrentSearchPets(new Pets());
      setLoading(false);

      return new Pets();
    },
    [throttleFetchCurrentSearchPets],
  );

  return (
    <PetSearchContext.Provider
      value={{
        loading,

        currentSearchQuery,
        currentSearchPets,
        currentSearchPetsHasLoaded,
        loadCurrentSearchPets,
      }}
    >
      {children}
    </PetSearchContext.Provider>
  );
};

export const usePetSearch = (): IPetSearchContext => {
  const context = useContext(PetSearchContext);

  if (context === undefined) {
    throw new Error('usePetSearch must be used within a PetSearchProvider');
  }

  return context;
};
