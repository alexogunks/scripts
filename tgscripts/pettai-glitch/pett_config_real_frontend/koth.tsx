import React, { createContext, useState, useContext, ReactNode } from 'react';

export interface IGameKingOfTheHillContext {
  loading: boolean;
}

const GameKingOfTheHillContext = createContext<IGameKingOfTheHillContext | undefined>(undefined);

export const GameKingOfTheHillProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading] = useState<boolean>(false);

  return (
    <GameKingOfTheHillContext.Provider
      value={{
        loading,
      }}
    >
      {children}
    </GameKingOfTheHillContext.Provider>
  );
};

export const useGameKingOfTheHill = (): IGameKingOfTheHillContext => {
  const context = useContext(GameKingOfTheHillContext);

  if (context === undefined) {
    throw new Error('useGameKingOfTheHill must be used within a GameKingOfTheHillProvider');
  }

  return context;
};
