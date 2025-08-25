import React, { createContext, ReactNode, useCallback, useContext, useState, useEffect } from 'react';
import { useThrottle } from '@hooks/useThrottle';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketUser } from '@interfaces/WebSocketResponse';
import { withSafeRetry } from '@utils/async';
import { formatEther } from 'ethers';
import { CONFIG } from '@/constants';

export interface IReferralData {
  usersUsed: WebSocketUser[];
  code: string;
  spendAmount: string;
  totalRefsAmount: number;
  referredBy: string | null;
}

interface IReferralContext {
  loading: boolean;
  referralData: IReferralData | null;
  referralDataHasLoadedOnce: boolean;
  loadReferralData: (throttle?: boolean) => Promise<IReferralData | void>;
}

const ReferralContext = createContext<IReferralContext | undefined>(undefined);

export const ReferralProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { referralGet } = useWebSocketMessenger();
  const [loading, setLoading] = useState<boolean>(false);
  const [referralData, setReferralData] = useState<IReferralData | null>(null);
  const [referralDataHasLoadedOnce, setReferralDataHasLoadedOnce] = useState<boolean>(false);

  const fetchReferralData = useCallback(async () => {
    const response = await withSafeRetry(() => referralGet());

    if (!response || response.error || !response.data) {
      throw new Error(response?.error || 'Failed to load referral data');
    }

    return response;
  }, [referralGet]);

  const throttleFetchReferralData = useThrottle(fetchReferralData, { time: CONFIG.THROTTLE.TIME_API });

  const loadReferralData = useCallback(
    async (throttle = true) => {
      setLoading(true);

      try {
        const response = await (throttle ? throttleFetchReferralData() : throttleFetchReferralData.force());

        const newReferralData: IReferralData = {
          usersUsed: response.data.usersUsed,
          code: response.data.code,
          spendAmount: response.data.spendAmount,
          totalRefsAmount: parseFloat(formatEther(response.data.totalRefsAmount)),
          referredBy: response.data.referredBy,
        };

        setReferralData(newReferralData);
        setReferralDataHasLoadedOnce(true);
        setLoading(false);

        return newReferralData;
      } catch (e) {
        console.error('Failed to load referral data:', e);
      }

      setLoading(false);
    },
    [throttleFetchReferralData],
  );

  useEffect(() => {
    loadReferralData().catch(e => {
      console.error('Failed to load referral data on startup:', e);
    });
  }, [loadReferralData]);

  return (
    <ReferralContext.Provider
      value={{
        loading,
        referralData,
        referralDataHasLoadedOnce,
        loadReferralData,
      }}
    >
      {children}
    </ReferralContext.Provider>
  );
};

export const useReferral = (): IReferralContext => {
  const context = useContext(ReferralContext);

  if (context === undefined) {
    throw new Error('useReferral must be used within a ReferralProvider');
  }

  return context;
};
