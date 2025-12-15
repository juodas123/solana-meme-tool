import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WalletContextType {
  wallets: string[];
  setWallets: (wallets: string[]) => void;
  getPrivateKeys: () => string[];
  addWallet: (wallet: string) => void;
  removeWallet: (index: number) => void;
  clearWallets: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletsProvider = ({ children }: { children: ReactNode }) => {
  const [wallets, setWallets] = useState<string[]>([]);

  const getPrivateKeys = () => {
    return wallets;
  };

  const addWallet = (wallet: string) => {
    setWallets((prev) => [...prev, wallet]);
  };

  const removeWallet = (index: number) => {
    setWallets((prev) => prev.filter((_, i) => i !== index));
  };

  const clearWallets = () => {
    setWallets([]);
  };

  return (
    <WalletContext.Provider
      value={{
        wallets,
        setWallets,
        getPrivateKeys,
        addWallet,
        removeWallet,
        clearWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWalletContext = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWalletContext must be used within a WalletsProvider');
  }
  return context;
};
