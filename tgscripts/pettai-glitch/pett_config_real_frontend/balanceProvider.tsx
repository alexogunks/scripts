import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useWebSocketMessenger } from '@hooks/useWebSocketMessenger';
import { WebSocketMessageDataDepositType } from '@interfaces/WebSocketMessage';
import {
  WebSocketResponseDeposit,
  WebSocketResponseTransfer,
  WebSocketResponseTransferOnChain,
  WebSocketResponseUpdate,
  WebSocketResponseWithdrawalCreate,
  WebSocketResponseWithdrawalJumpAction,
  WebSocketResponseWithdrawalRedeemAction,
  WebSocketTransaction,
  WebSocketTransfer,
  WebSocketWithdrawalDataInfoWithJumpFee,
} from '@interfaces/WebSocketResponse';
import { useAuth } from '@providers/AuthProvider';
import { formatBigInt } from '@utils/balance';
import { multiplyBigIntFloat } from '@utils/numbers';
import { formatEther } from 'ethers';

export interface IATMTransaction extends WebSocketTransfer {
  type: 'transfer';
}

export interface IWalletTransaction extends WebSocketTransaction {
  type: 'deposit' | 'withdrawal';
  toPet: string;
}

export type ITransaction = IATMTransaction | IWalletTransaction;

export interface Balance {
  native: bigint;
  token: bigint;
  nativeDisplay: string;
  tokenDisplay: string;
}

export interface Stats {
  queueSize: number;
  queuePosition: number | undefined;
  transactionCount: number;
  recentTransfers: bigint;
  recentTransfersDisplay: string;
}

export interface Fee {
  network: bigint | null;
  jump: bigint | null;
  transfer: number;
  atm: number;
  networkDisplay: string | null;
  jumpDisplay: string | null;
}

export const transactionAssetValues = ['sol', 'eth', 'aip'];
export const transactionTypeValues = ['Deposit', 'Withdraw', 'Transfer', 'ATM'];

export type TransactionAsset = (typeof transactionAssetValues)[number];
export type TransactionType = (typeof transactionTypeValues)[number];

export interface Recipient {
  avatar: string;
  name: string;
}

export interface BalanceContextType {
  withdraw: (amount: bigint, isEth: boolean) => Promise<WebSocketResponseWithdrawalCreate | null>;
  transfer: (
    recipient: string,
    amount: number,
    type: 'aip' | 'sol' | 'eth',
  ) => Promise<WebSocketResponseTransferOnChain | null>;
  atm: (recipientID: string, amount: bigint) => Promise<WebSocketResponseTransfer | null>;
  deposit: (amount: bigint, depositType: WebSocketMessageDataDepositType) => Promise<WebSocketResponseDeposit | null>;
  getTransaction: (id: string) => Promise<ITransaction | undefined>;
  getTransactions: (type?: TransactionType, timestamp?: number) => Promise<ITransaction[]>;
  redeem: (id: string) => Promise<WebSocketResponseWithdrawalRedeemAction | null>;
  jump: (id: string) => Promise<WebSocketResponseWithdrawalJumpAction | null>;
  getWithdrawals: () => Promise<WebSocketWithdrawalDataInfoWithJumpFee[]>;
  switchAsset: (asset: TransactionAsset) => Promise<WebSocketResponseUpdate | null>;
  asset: TransactionAsset;
  assetUpperCase: string;
  balance: Balance;
  stats: Stats;
  fee: Fee;
  transactions: ITransaction[];
  loadTransactions: () => Promise<ITransaction[]>;
  depositLoading: boolean;
  withdrawLoading: boolean;
  jumpLoading: boolean;
  redeemLoading: boolean;

  // Errors
  depositError: string | null;
  withdrawError: string | null;
  jumpError: string | null;
  redeemError: string | null;
  infoError: string | null;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export const BalanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { wsPet } = useAuth();

  const {
    switchAsset: wsSwitchAsset,
    getRecentTransfers: wsGetRecentTransfers,
    getTransactions: wsGetTransactions,
    getSingleTransaction: wsGetSingleTransaction,
    getWithdrawAndATMInfo: wsGetWithdrawAndATMInfo,
    deposit: wsDeposit,
    withdrawalCreate: wsWithdrawalCreate,
    withdrawalJump: wsWithdrawalJump,
    withdrawalRedeem: wsWithdrawalRedeem,
    withdrawalData: wsWithdrawalData,
    transfer: wsATM,
    transferOnChain: wsTransferOnChain,
  } = useWebSocketMessenger();

  const [infoError, setError] = useState<string | null>(null);

  const [withdrawLoading, setWithdrawLoading] = useState<boolean>(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const [jumpLoading, setJumpLoading] = useState<boolean>(false);
  const [jumpError, setJumpError] = useState<string | null>(null);

  const [depositLoading, setDepositLoading] = useState<boolean>(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  const [redeemLoading, setRedeemLoading] = useState<boolean>(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [recentATMTransfers, setRecentATMTransfers] = useState<WebSocketTransfer[]>([]);
  const [transactionsHasLoadedOnce, setTransactionsHasLoadedOnce] = useState<boolean>(false);

  const [asset, setAsset] = useState<TransactionAsset>(wsPet?.PetTokens.useSolana ? 'sol' : 'eth');
  const assetUpperCase = useMemo(() => asset.toUpperCase(), [asset]);

  const [balance, setBalance] = useState<Balance>({
    native: 0n,
    token: 0n,
    nativeDisplay: '0',
    tokenDisplay: '0',
  });
  const [stats, setStats] = useState<Stats>({
    queuePosition: undefined,
    queueSize: 0,
    transactionCount: 0,
    recentTransfers: 0n,
    recentTransfersDisplay: '0',
  });
  const [fee, setFee] = useState<Fee>({
    network: 0n,
    jump: 0n,
    transfer: 0,
    atm: 5,
    networkDisplay: '0',
    jumpDisplay: '0',
  });

  const loadTransactions = useCallback(async (): Promise<ITransaction[]> => {
    try {
      let allTransactions: ITransaction[] = [];
      const [recentTransfers, transactions] = await Promise.all([wsGetRecentTransfers(), wsGetTransactions()]);

      if (recentTransfers) {
        // add type 'transfer' to recent transfers
        const recentTransfersWithType: IATMTransaction[] = recentTransfers.data.transfers.map(transfer => ({
          asset: 'aip',
          type: 'transfer',
          id: transfer.id,
          amount: transfer.data.amount,
          fromPet: transfer.data.fromPet,
          toPet: transfer.data.toPet,
          timestamp: new Date(transfer.date).getTime(),
          taxPercentage: transfer.data.taxedAmount,
          taxAmount: multiplyBigIntFloat(BigInt(transfer.data.amount), transfer.data.taxedAmount + 1).toString(),
        }));
        setRecentATMTransfers(recentTransfersWithType);
        allTransactions = [...allTransactions, ...recentTransfersWithType];
      }

      if (transactions) {
        allTransactions = [...allTransactions, ...transactions.data.transactions];
      }

      setTransactions(allTransactions);
      setTransactionsHasLoadedOnce(true);

      return allTransactions;
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load transactions';
      setError(errorMessage);
      console.error('Load transactions error:', e);

      return [];
    }
  }, [wsGetRecentTransfers, wsGetTransactions]);

  // Real implementations (replace with your API logic)
  const withdraw = useCallback(
    async (amount: bigint, isEth: boolean) => {
      try {
        setWithdrawLoading(true);
        setWithdrawError(null);

        const response = await wsWithdrawalCreate(Number(formatEther(amount)), isEth);

        if (response?.error) {
          setWithdrawError(response.error);
          throw new Error(response.error);
        }

        if (!response?.data) {
          throw new Error('Withdrawal creation failed');
        }

        return response;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Withdrawal creation failed';
        setWithdrawError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setWithdrawLoading(false);
        // settimeout 10seconds to load transactions
        setTimeout(() => {
          loadTransactions();
        }, 10000);
      }
    },
    [loadTransactions, wsWithdrawalCreate],
  );

  const transfer = useCallback(
    async (recipient: string, amount: number, type: 'aip' | 'sol' | 'eth') => {
      const response = await wsTransferOnChain(recipient, amount, type);

      if (response?.error) {
        throw new Error(response.error);
      }

      return response;
    },
    [wsTransferOnChain],
  );

  const atm = useCallback(
    async (recipientID: string, amount: bigint) => {
      try {
        const response = await wsATM(recipientID, amount.toString());

        if (response?.error) {
          throw new Error(response.error);
        }

        // Reload transactions after successful ATM transaction
        loadTransactions();

        return response;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'ATM failed';
        setError(errorMessage);
        console.error('ATM error:', e);

        return null;
      }
    },
    [wsATM, loadTransactions],
  );

  const deposit = useCallback(
    async (amount: bigint, depositType: WebSocketMessageDataDepositType) => {
      try {
        setDepositLoading(true);
        setDepositError(null);

        const response = await wsDeposit(depositType, amount.toString());

        if (response?.error) {
          setDepositError(response.error);
          throw new Error(response.error);
        }

        if (!response?.data) {
          throw new Error('Deposit failed');
        }

        // Reload transactions after successful deposit, await here takes a bit too much time.
        loadTransactions();

        return response;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Deposit failed';
        setDepositError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setDepositLoading(false);
      }
    },
    [wsDeposit, loadTransactions],
  );

  const getTransaction = useCallback(
    async (id: string) => {
      // Ensure transactions are loaded at least once
      if (!transactionsHasLoadedOnce) {
        await loadTransactions();
      }

      // Try to find the transaction in the local state
      let transaction = transactions.find(tx => tx.id === id);

      // If not found, reload transactions and try again
      if (!transaction) {
        await loadTransactions();
        transaction = transactions.find(tx => tx.id === id);
      }

      // If still not found, fetch from server as a last resort
      if (!transaction) {
        try {
          const transactionResponse = await wsGetSingleTransaction(id);

          if (transactionResponse && transactionResponse.data && transactionResponse.data.transaction) {
            const transactionData = transactionResponse.data.transaction;
            const type = transactionData.data.type;

            if (type === 'transfer') {
              const tx: IATMTransaction = {
                id: transactionData.id,
                type,
                asset: 'aip',
                amount: transactionData.data.amount,
                timestamp: new Date(transactionData.date).getTime(),
                taxPercentage: transactionData.data.taxedAmount,
                taxAmount: transactionData.data.taxedAmount.toString(),
                toPet: transactionData.data.toPet,
                fromPet: transactionData.data.fromPet,
              };
              setTransactions(prev => [...prev, tx]);

              return tx;
            } else if (type === 'withdrawal' || type === 'deposit') {
              const tx: IWalletTransaction = {
                id: transactionData.id,
                type,
                asset: transactionData.asset,
                amount: transactionData.data.amount,
                timestamp: new Date(transactionData.date).getTime(),
                taxPercentage: transactionData.data.taxedAmount,
                taxAmount: transactionData.data.taxedAmount.toString(),
                toPet: transactionData.data.toPet,
              };
              setTransactions(prev => [...prev, tx]);

              return tx;
            }
          }
        } catch (e) {
          console.error('Failed to fetch transaction from server:', e);
        }

        // If not found or error, return undefined
        return undefined;
      }

      // Return the found transaction
      return transaction;
    },
    // Add dependencies to avoid stale closures
    [transactions, transactionsHasLoadedOnce, wsGetSingleTransaction, loadTransactions],
  );

  const getTransactions = useCallback(
    async (type?: TransactionType, timestamp?: number) => {
      if (!transactionsHasLoadedOnce) {
        await loadTransactions();
      }

      let filteredTransactions = transactions.filter(transaction => {
        if (type) {
          return transaction.type === type;
        }

        return true;
      });

      if (timestamp) {
        filteredTransactions = filteredTransactions.filter(transaction => {
          return transaction.timestamp === timestamp;
        });
      }

      return filteredTransactions;
    },
    [transactions, transactionsHasLoadedOnce, loadTransactions],
  );

  const getWithdrawals = useCallback(async () => {
    const result = await wsWithdrawalData();

    if (result && result.data && Array.isArray(result.data.response)) {
      return result.data.response;
    } else {
      console.error('Failed to fetch withdrawals data:', result);
    }

    return [];
  }, [wsWithdrawalData]);

  // Asset switching
  const switchAsset = useCallback(
    async (asset: TransactionAsset): Promise<WebSocketResponseUpdate | null> => {
      if (asset === 'aip') {
        return null;
      }

      const currentAsset = wsPet?.PetTokens.useSolana ? 'sol' : 'eth';

      if (asset === currentAsset) {
        throw new Error('You are already using this asset');
      }

      const response = await wsSwitchAsset(asset);

      if (!response) {
        return null;
      }

      return response;
    },
    [wsPet, wsSwitchAsset],
  );

  const loadWithdrawAndATMInfo = useCallback(async () => {
    try {
      const withdrawAndATMInfo = await wsGetWithdrawAndATMInfo();

      const totalRecentTransfers = recentATMTransfers.reduce((acc, transfer) => acc + BigInt(transfer.amount), 0n);

      if (withdrawAndATMInfo && recentATMTransfers) {
        setStats({
          queuePosition: withdrawAndATMInfo.data.withdrawalInfo.topPositionWithdraw?.position,
          queueSize: parseFloat(formatEther(withdrawAndATMInfo.data.withdrawalInfo.queueSize)),
          transactionCount: recentATMTransfers.length,
          recentTransfers: totalRecentTransfers,
          recentTransfersDisplay: formatBigInt(totalRecentTransfers),
        });
        setFee({
          transfer: 0,
          atm: withdrawAndATMInfo.data.atmInfo.taxATM * 100,
          network: 0n,
          networkDisplay: withdrawAndATMInfo.data.withdrawalInfo.jumpPrice
            ? formatBigInt(BigInt(withdrawAndATMInfo.data.withdrawalInfo.jumpPrice))
            : null,
          jump: withdrawAndATMInfo.data.withdrawalInfo.jumpPrice,
          jumpDisplay: withdrawAndATMInfo.data.withdrawalInfo.jumpPrice
            ? formatBigInt(BigInt(withdrawAndATMInfo.data.withdrawalInfo.jumpPrice))
            : null,
        });
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to load withdraw and ATM info';
      setError(errorMessage);
      console.error('Load withdraw and ATM info error:', e);
    }
  }, [recentATMTransfers, wsGetWithdrawAndATMInfo]);

  // Update balance/stats/fee from real data
  useEffect(() => {
    if (wsPet && wsPet.PetTokens) {
      let native, nativeDisplay;
      const token = BigInt(wsPet.PetTokens.tokens);
      const tokenDisplay = formatBigInt(token);

      if (asset.toLowerCase() === 'sol') {
        native = BigInt(wsPet.PetTokens.solanaTokens);
        nativeDisplay = formatBigInt(native);
      } else {
        native = BigInt(wsPet.PetTokens.ethTokens);
        nativeDisplay = formatBigInt(native);
      }

      setBalance({ native, token, nativeDisplay, tokenDisplay });
      setAsset(wsPet.PetTokens.useSolana ? 'sol' : 'eth');
    }
  }, [wsPet, asset]);

  useEffect(() => {
    loadWithdrawAndATMInfo();
  }, [loadWithdrawAndATMInfo]);

  const jump = useCallback(
    async (id: string) => {
      try {
        setJumpLoading(true);
        setJumpError(null);

        const response = await wsWithdrawalJump(id);

        if (response?.error) {
          setJumpError(response.error);
          throw new Error(response.error);
        }

        if (!response?.data) {
          throw new Error('Failed to jump withdrawal');
        }

        return response;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to jump withdrawal';
        setJumpError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setJumpLoading(false);
        // settimeout 10seconds to load transactions
        setTimeout(() => {
          loadTransactions();
        }, 10000);
      }
    },
    [loadTransactions, wsWithdrawalJump],
  );

  const redeem = useCallback(
    async (id: string) => {
      try {
        setRedeemLoading(true);
        setRedeemError(null);

        const response = await wsWithdrawalRedeem(id);

        if (response?.error) {
          setRedeemError(response.error);
          throw new Error(response.error);
        }

        if (!response?.data) {
          throw new Error('Failed to jump withdrawal');
        }

        return response;
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Failed to redeem withdrawal';
        setRedeemError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setRedeemLoading(false);
        // settimeout 10seconds to load transactions
        setTimeout(() => {
          loadTransactions();
        }, 10000);
      }
    },
    [loadTransactions, wsWithdrawalRedeem],
  );

  return (
    <BalanceContext.Provider
      value={{
        asset,
        assetUpperCase,
        balance,
        stats,
        fee,
        switchAsset,
        getTransaction,
        getTransactions,
        getWithdrawals,
        withdraw,
        transfer,
        atm,
        deposit,
        redeem,
        jump,
        transactions,
        loadTransactions,
        depositLoading,
        withdrawLoading,
        jumpLoading,
        redeemLoading,
        depositError,
        withdrawError,
        jumpError,
        redeemError,
        infoError,
      }}
    >
      {children}
    </BalanceContext.Provider>
  );
};

export const useBalance = (): BalanceContextType => {
  const context = useContext(BalanceContext);

  if (context === undefined) {
    throw new Error('useBalance must be used within a BalanceProvider');
  }

  return context;
};
