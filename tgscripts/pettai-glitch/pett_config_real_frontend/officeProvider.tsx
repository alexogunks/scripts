import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback, useRef } from 'react';
import { GlobalEvent } from '@interfaces/WebSocketResponse';
import { useWebSocketMessenger } from '../hooks/useWebSocketMessenger';

export interface IOfficeTransaction {
  id: number;
  createdAtUnixTimestamp: number;
  title: string;
  amount: bigint;
  token: string;
  type: 'income' | 'expense';
}

export interface IOfficeContext {
  rtim: number;
  irsEvent: GlobalEvent | null;
  accountantData: {
    number: number;
    price: number;
  } | null;
  accountantActive: boolean;
  taxAmountProx: number;
  loadingOfficeData: boolean;
  loadingTransactionsList: boolean;
  hasLoadedOnce: boolean;

  getTransactionsListData: () => Promise<void>;
  refreshOfficeData: () => Promise<void>;
  checkAndRefreshIfNeeded: () => Promise<void>;
}

const OfficeContext = createContext<IOfficeContext | undefined>(undefined);

// Data refresh interval in milliseconds (1 minute)
const DATA_REFRESH_INTERVAL = 60000;

export const OfficeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // States
  const [loadingOfficeData, setLoadingOfficeData] = useState<boolean>(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);

  const [rtim, setRtim] = useState<number>(0);
  const [irsEvent, setIrsEvent] = useState<GlobalEvent | null>(null);
  const [accountantData, setAccountantData] = useState<{ number: number; price: number } | null>(null);
  const [accountantActive, setAccountantActive] = useState<boolean>(false);
  const [taxAmountProx, setTaxAmountProx] = useState<number>(0);

  // Loading states
  const [loadingTransactionsList, setLoadingTransactionsList] = useState<boolean>(true);

  // Refs for tracking last data load time
  const lastDataLoadTime = useRef<number>(0);

  const { officeDataGet } = useWebSocketMessenger();

  const getTransactionsListData = useCallback(async () => {
    setLoadingTransactionsList(true);
    // TODO: Implement transactions list fetching
    setLoadingTransactionsList(false);
  }, []);

  const loadOfficeData = useCallback(async () => {
    setLoadingOfficeData(true);

    try {
      const response = await officeDataGet();

      if (response && !response.error) {
        const { rtim, irsEvent } = response.data;
        setRtim(rtim);
        setIrsEvent(irsEvent.data);
        setAccountantData({
          number: irsEvent.accountantNumber,
          price: irsEvent.accountantPrice,
        });
        // Set accountant active status - this might need to be updated based on actual API response
        setAccountantActive(false); // TODO: Update this based on actual API response
        setTaxAmountProx(irsEvent.taxAmountProx);

        // Update last load time
        lastDataLoadTime.current = Date.now();

        // Mark as loaded once
        setHasLoadedOnce(true);
      }
    } catch (error) {
      console.error('[OfficeProvider] Failed to load office data:', error);
    } finally {
      setLoadingOfficeData(false);
    }
  }, [officeDataGet]);

  const refreshOfficeData = useCallback(async () => {
    console.log('[OfficeProvider] Manual refresh triggered');
    await loadOfficeData();
  }, [loadOfficeData]);

  const checkAndRefreshIfNeeded = useCallback(async () => {
    // Only refresh if data has been loaded at least once and is older than 1 minute
    if (lastDataLoadTime.current === 0) {
      return;
    }

    const now = Date.now();
    const timeSinceLastLoad = now - lastDataLoadTime.current;

    if (timeSinceLastLoad > DATA_REFRESH_INTERVAL) {
      console.log('[OfficeProvider] Refreshing office data (data is older than 1 minute)');
      await loadOfficeData();
    }
  }, [loadOfficeData]);

  useEffect(() => {
    getTransactionsListData();
  }, [getTransactionsListData]);

  // Load office data only once on mount
  useEffect(() => {
    loadOfficeData();
  }, [loadOfficeData]);

  return (
    <OfficeContext.Provider
      value={{
        rtim,
        irsEvent,
        accountantData,
        accountantActive,
        taxAmountProx,
        loadingOfficeData,
        loadingTransactionsList,
        hasLoadedOnce,
        getTransactionsListData,
        refreshOfficeData,
        checkAndRefreshIfNeeded,
      }}
    >
      {children}
    </OfficeContext.Provider>
  );
};

export const useOffice = (): IOfficeContext => {
  const context = useContext(OfficeContext);

  if (context === undefined) {
    throw new Error('useOffice must be used within a OfficeProvider');
  }

  return context;
};
