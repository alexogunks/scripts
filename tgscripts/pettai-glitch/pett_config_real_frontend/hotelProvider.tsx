import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { withSafeRetry } from '@utils/async';
import { Collection } from '@utils/collection';
import moment from 'moment';
import { useToast } from './ToastProvider';
import { CONFIG } from '@/constants';

export interface IHotelTier {
  tier: number;
  name: string;
  basePrice: bigint;
  effectAdd: number;
  tokensPerMin: bigint;
  tokensPerDay: bigint;
  xpPerMin: number;
  xpPerDay: number;
}

export type HotelDurationType = '1d' | '7d' | '30d';
export interface IHotelDuration {
  name: string;
  duration: number;
  durationType: HotelDurationType;
  durationDays: number;
  priceMultiplier: number;
}

export interface IUserHotel {
  id: string;
  petID: string;
  duration: number;
  durationOptions: IHotelDuration[];
  tier: IHotelTier;
  startDate: moment.Moment;
  endDate: moment.Moment;
  checkedIn: boolean;
}

export interface IRoomOption {
  id: string;
  duration: number;
  expTotal: number;
  aipTotal: number;
  ethPrice: number;
  ethOriginalPrice: number;
  discount: number;
}

export interface IRoom {
  id: string;
  name: string;
  image: string;
  stars: number;
  regeneration: number;
  ethPrice: number;
  exp: {
    minute: number;
    daily: number;
  };
  aip: {
    minute: number;
    daily: number;
  };
  options: IRoomOption[];
}

export interface IHotelStay {
  room: IRoom;
  option: IRoomOption;
  fromUnixTimestamp: number;
  toUnixTimestamp: number;
}

export interface IHotel {
  rooms: IRoom[];
  currentStay: IHotelStay | null;
}

class Hotels extends Collection<IUserHotel> {}

export interface IHotelContext {
  tiers: IHotelTier[];
  tiersHasLoadedOnce: boolean;

  durations: IHotelDuration[];
  durationsHasLoadedOnce: boolean;

  hotels: Hotels;
  hotelsHasLoadedOnce: boolean;

  loadHotels: () => Promise<void>;

  currentHotel: IUserHotel | null;
  loading: boolean;
  buy: (tier: IHotelTier, duration: IHotelDuration) => Promise<IUserHotel>;
  checkIn: (tier: IHotelTier) => Promise<IUserHotel>;
  checkOut: () => Promise<boolean>;
}

const HotelContext = createContext<IHotelContext | undefined>(undefined);

export const HotelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { hotelBuy, hotelGet, hotelCheckIn, hotelCheckOut } = useWebSocketMessenger();
  const { showError } = useToast();
  const [loading, setLoading] = useState<boolean>(true);

  const [tiers, setTiers] = useState<IHotelTier[]>([]);
  const [tiersHasLoadedOnce, setTiersHasLoadedOnce] = useState<boolean>(false);

  const [durations, setDurations] = useState<IHotelDuration[]>([]);
  const [durationsHasLoadedOnce, setDurationsHasLoadedOnce] = useState<boolean>(false);

  const [hotels, setHotels] = useState<Hotels>(new Hotels([]));
  const [hotelsHasLoadedOnce, setHotelsHasLoadedOnce] = useState<boolean>(false);

  const [currentHotel, setCurrentHotel] = useState<IUserHotel | null>(null);

  const getTierName = (tier: number) => {
    return (
      {
        1: 'Basic Room',
        2: 'Mid-Tier Room',
        3: 'Premium Room',
      }[tier] || 'Unknown room'
    );
  };

  const fetchHotels = useCallback(async () => {
    const response = await withSafeRetry(() => hotelGet());

    if (!response || response.error || !response.data) {
      throw new Error(response?.error || 'Failed to load hotel');
    }

    return response;
  }, [hotelGet]);

  const throttleFetchHotels = useThrottle(fetchHotels, { time: CONFIG.THROTTLE.TIME_API });

  const loadHotels = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchHotels() : throttleFetchHotels.force());

        const keys = Object.keys(response.data.hotel_durations || {});
        const newDurations: IHotelDuration[] = [];
        const newTiers: IHotelTier[] = [];
        const newHotels: IUserHotel[] = [];
        let newCurrentHotel = null;

        keys.forEach(key =>
          newDurations.push({
            name: key,
            duration: response.data.hotel_durations[key]?.duration || 0,
            durationType: key as HotelDurationType,
            durationDays: response.data.hotel_durations[key]?.duration
              ? Math.floor(response.data.hotel_durations[key].duration / 86400)
              : 0,
            priceMultiplier: response.data.hotel_durations[key]?.priceMultiplier || 0,
          }),
        );

        response.data.hotel_tiers?.forEach(tier =>
          newTiers.push({
            tier: tier.tier,
            name: getTierName(tier.tier),
            basePrice: BigInt(tier.basePrice),
            effectAdd: tier.effectAdd,
            tokensPerMin: BigInt(tier.tokensPerMin),
            tokensPerDay: BigInt(tier.tokensPerMin) * 60n * 24n,
            xpPerMin: tier.xpPerMin,
            xpPerDay: tier.xpPerMin * 60 * 24,
          }),
        );

        response.data.petHotels?.forEach(hotel => {
          const tier = newTiers.find(tier => tier.tier === hotel.tier);

          if (!tier) {
            console.error('Failed to get duration or tier for pet hotel', hotel, tier);

            return;
          }

          const newHotel = {
            id: hotel.id,
            petID: hotel.petID,
            duration: hotel.duration,
            durationOptions: newDurations,
            tier,
            startDate: moment(hotel.startDate),
            endDate: moment(hotel.startDate).add(hotel.duration, 'seconds'),
            checkedIn: hotel.checkedIn,
          };

          newHotels.push(newHotel);

          if (newHotel.checkedIn) {
            newCurrentHotel = newHotel;
          }
        });

        setDurations(newDurations);
        setDurationsHasLoadedOnce(true);
        setTiers(newTiers);
        setTiersHasLoadedOnce(true);
        setHotels(new Hotels(newHotels));
        setHotelsHasLoadedOnce(true);
        setCurrentHotel(newCurrentHotel);
      } catch (e) {
        console.error(e);
      }

      setLoading(false);
    },
    [throttleFetchHotels],
  );

  const buy = useCallback(
    async (tier: IHotelTier, duration: IHotelDuration): Promise<IUserHotel> => {
      const response = await withSafeRetry(() => hotelBuy(tier.tier, duration.name));

      if (!response || response.error || !response.data.hotelInstance) {
        return Promise.reject(response?.error || 'Failed to buy');
      }

      const hotelInstance = response.data.hotelInstance;
      const hotelDuration = durations.find(duration => duration.duration === hotelInstance.duration);
      const hotelTier = tiers.find(tier => tier.tier === hotelInstance.tier);

      if (!hotelTier) {
        console.error('Failed to get duration or tier for pet hotel in buy', hotelDuration, hotelTier);
        showError('Failed to get bought pet hotel');

        return Promise.reject('Failed to get duration or tier for pet hotel in buy');
      }

      loadHotels(false);

      return {
        id: hotelInstance.id,
        petID: hotelInstance.petID,
        duration: hotelInstance.duration,
        durationOptions: durations,
        tier: hotelTier,
        startDate: moment(hotelInstance.startDate),
        endDate: moment(hotelInstance.startDate).add(hotelInstance.duration, 'seconds'),
        checkedIn: hotelInstance.checkedIn,
      };
    },
    [tiers, durations, loadHotels, hotelBuy, showError],
  );

  const checkIn = useCallback(
    async (tier: IHotelTier) => {
      setLoading(true);
      const response = await withSafeRetry(() => hotelCheckIn(tier.tier));

      if (!response || response.error) {
        return Promise.reject(response?.error || 'Failed to check in');
      }

      if (!response || response.error || !response.data.hotelInstance) {
        return Promise.reject(response?.error || 'Failed to check in');
      }

      const hotelInstance = response.data.hotelInstance;
      const hotelDuration = durations.find(duration => duration.duration === hotelInstance.duration);
      const hotelTier = tiers.find(tier => tier.tier === hotelInstance.tier);

      if (!hotelTier) {
        console.error('Failed to get duration or tier for pet hotel in CheckIn', hotelDuration, hotelTier);
        showError('Failed to get bought pet hotel');

        return Promise.reject('Failed to get duration or tier for pet hotel in CheckIn');
      }

      const newHotel = {
        id: hotelInstance.id,
        petID: hotelInstance.petID,
        duration: hotelInstance.duration,
        durationOptions: durations,
        tier: hotelTier,
        startDate: moment(hotelInstance.startDate),
        endDate: moment(hotelInstance.startDate).add(hotelInstance.duration, 'seconds'),
        checkedIn: hotelInstance.checkedIn,
      };

      // Immediately update currentHotel state for blocking logic
      setCurrentHotel(newHotel);

      await loadHotels(false);
      setLoading(false);

      return newHotel;
    },
    [tiers, durations, loadHotels, hotelCheckIn, showError],
  );

  const checkOut = useCallback(async () => {
    setLoading(true);
    const response = await withSafeRetry(() => hotelCheckOut());

    if (!response || response.error) {
      showError('Failed to checkout');

      return Promise.reject(response?.error || 'Failed to check out');
    }

    // Immediately update currentHotel state for blocking logic
    setCurrentHotel(null);

    await loadHotels(false);
    setLoading(false);

    return true;
  }, [loadHotels, hotelCheckOut, showError]);

  return (
    <HotelContext.Provider
      value={{
        tiers,
        tiersHasLoadedOnce,

        durations,
        durationsHasLoadedOnce,

        hotels,
        hotelsHasLoadedOnce,
        loadHotels,

        currentHotel,
        loading,
        buy,
        checkIn,
        checkOut,
      }}
    >
      {children}
    </HotelContext.Provider>
  );
};

export const useHotel = (): IHotelContext => {
  const context = useContext(HotelContext);

  if (context === undefined) {
    throw new Error('useHotel must be used within a HotelProvider');
  }

  return context;
};
