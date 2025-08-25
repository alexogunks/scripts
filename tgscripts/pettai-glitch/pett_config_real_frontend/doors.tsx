import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketDoors } from '@interfaces/WebSocketResponse';
import moment from 'moment/moment';

// Interface to match the expected result structure for the game
export interface IGameDoorsResult {
  success: boolean;
  guess?: number;
  reward?: string;
  rewardData: {
    type: 'tokens' | 'consumable' | 'stats' | 'xp' | '';
    value: '$AIP' | string | 'maxed' | 'XP' | '';
    amount: string;
  };
  availableDate?: string;
  error?: string;
}

export interface IGameDoorsContext {
  loading: boolean;
  loadingResult: boolean;
  lastResult: WebSocketDoors | null;
  cooldownExpiresAtUnixTimestamp: number | null;
  availableDate: string | null;
  play: (selectedNumber: number) => Promise<IGameDoorsResult>;
  resetAndRefetch: () => Promise<void>;
}

const GameDoorsContext = createContext<IGameDoorsContext | undefined>(undefined);

// Key for localStorage
const DOORS_AVAILABLE_DATE_KEY = 'doors_available_date';

export const GameDoorsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lastResult, setLastResult] = useState<WebSocketDoors | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingResult, setLoadingResult] = useState<boolean>(false);
  const [cooldownExpiresAtUnixTimestamp, setCooldownExpiresAtUnixTimestamp] = useState<number | null>(null);

  // Initialize availableDate from localStorage
  const [availableDate, setAvailableDate] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DOORS_AVAILABLE_DATE_KEY);
    } catch (error) {
      console.error('Failed to load doors available date from localStorage:', error);

      return null;
    }
  });

  // Use refs to prevent multiple calls
  const hasInitialized = useRef(false);
  const hasFetched = useRef(false); // Prevent multiple fetches

  const { doorsTimeLeft, doors } = useWebSocketMessenger();

  // Helper function to update availableDate and persist to localStorage
  const updateAvailableDate = useCallback((newAvailableDate: string) => {
    setAvailableDate(newAvailableDate);

    try {
      localStorage.setItem(DOORS_AVAILABLE_DATE_KEY, newAvailableDate);
    } catch (error) {
      console.error('Failed to save doors available date to localStorage:', error);
    }
  }, []);

  const play = useCallback(async (selectedNumber: number): Promise<IGameDoorsResult> => {
    setLoadingResult(true);

    try {
      // Use the actual WebSocket doors() method
      const response = await doors();

      if (response && response.data) {
        const doorsResult = response.data;

        console.log(doorsResult);

        if (doorsResult.success) {
          // Create result matching our interface
          const result: IGameDoorsResult = {
            success: true,
            guess: selectedNumber,
            reward: doorsResult.reward,
            rewardData: doorsResult.rewardData,
            availableDate: doorsResult.availableDate,
          };

          setLastResult(doorsResult);

          // Update availableDate from server response and persist to localStorage
          if (doorsResult.availableDate) {
            updateAvailableDate(doorsResult.availableDate);
            // Set cooldown based on the availableDate
            const availableMoment = moment(doorsResult.availableDate);
            setCooldownExpiresAtUnixTimestamp(availableMoment.unix());
          }

          return result;
        } else {
          // Handle unsuccessful game result
          throw new Error(doorsResult.error || 'Game failed');
        }
      } else {
        throw new Error('Invalid response from doors game');
      }
    } catch (error) {
      console.error('Failed to play doors game:', error);

      // Return a failed result
      const failedResult: IGameDoorsResult = {
        success: false,
        guess: selectedNumber,
        rewardData: {
          type: '',
          value: '',
          amount: '0',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setLastResult(null);

      return failedResult;
    } finally {
      setLoadingResult(false);
    }
  }, [doors, updateAvailableDate]);

  // Helper function to reset localStorage and refetch from server
  const resetAndRefetch = useCallback(async () => {
    try {
      // Clear localStorage
      localStorage.removeItem(DOORS_AVAILABLE_DATE_KEY);
      setAvailableDate(null);
      setCooldownExpiresAtUnixTimestamp(null);

      // Refetch from server
      setLoading(true);
      const response = await doorsTimeLeft();

      if (response && response.data) {
        const { availableDate: serverAvailableDate, seconds } = response.data;

        // Store the new availableDate
        if (serverAvailableDate) {
          updateAvailableDate(serverAvailableDate);
        }

        const secondsLeft = parseInt(seconds);

        if (secondsLeft > 0) {
          // If there's time left, set the cooldown
          setCooldownExpiresAtUnixTimestamp(moment().add(secondsLeft, 'seconds').unix());
        } else {
          // No cooldown, player can play
          setCooldownExpiresAtUnixTimestamp(null);
        }
      }
    } catch (error) {
      console.error('Failed to reset and refetch doors data:', error);
    } finally {
      setLoading(false);
    }
  }, [doorsTimeLeft, updateAvailableDate]);

  // Initialize once - prevent any double fetching
  useEffect(() => {
    if (hasInitialized.current) {
      return;
    }

    hasInitialized.current = true;

    // Check if we already have a valid availableDate
    if (availableDate) {
      const availableMoment = moment(availableDate);
      const now = moment();

      if (availableMoment.isAfter(now)) {
        // If the available date is in the future (we can't play yet), set cooldown
        setCooldownExpiresAtUnixTimestamp(availableMoment.unix());
      } else {
        // Available date is in the past (we can play), no cooldown needed
        setCooldownExpiresAtUnixTimestamp(null);
      }

      setLoading(false);

      return;
    }

    // No availableDate stored, fetch from server (but only once)
    if (hasFetched.current) {
      setLoading(false);

      return;
    }

    hasFetched.current = true;

    const fetchTimeLeft = async () => {
      try {
        console.log('fetching doors time left');
        const response = await doorsTimeLeft();

        if (response && response.data) {
          const { availableDate: serverAvailableDate, seconds } = response.data;

          // Store the availableDate and persist to localStorage
          if (serverAvailableDate) {
            updateAvailableDate(serverAvailableDate);
          }

          const secondsLeft = parseInt(seconds);

          if (secondsLeft > 0) {
            // If there's time left, set the cooldown
            setCooldownExpiresAtUnixTimestamp(moment().add(secondsLeft, 'seconds').unix());
          } else {
            // No cooldown, player can play
            setCooldownExpiresAtUnixTimestamp(null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch doors time left:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeLeft();
  }, [availableDate, doorsTimeLeft, updateAvailableDate]); // Add the missing dependencies

  return (
    <GameDoorsContext.Provider
      value={{
        loading,
        loadingResult,
        lastResult,
        cooldownExpiresAtUnixTimestamp,
        availableDate,
        play,
        resetAndRefetch,
      }}
    >
      {children}
    </GameDoorsContext.Provider>
  );
};

export const useGameDoors = (): IGameDoorsContext => {
  const context = useContext(GameDoorsContext);

  if (context === undefined) {
    throw new Error('useGameDoors must be used within a GameDoorsProvider');
  }

  return context;
};