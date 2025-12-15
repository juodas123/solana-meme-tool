import React, { createContext, useContext, useState, ReactNode } from 'react';

interface VolumeContextType {
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  volumeData: any;
  setVolumeData: (data: any) => void;
}

const VolumeContext = createContext<VolumeContextType | undefined>(undefined);

export const VolumeProvider = ({ children }: { children: ReactNode }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [volumeData, setVolumeData] = useState<any>(null);

  return (
    <VolumeContext.Provider
      value={{
        isRunning,
        setIsRunning,
        volumeData,
        setVolumeData,
      }}
    >
      {children}
    </VolumeContext.Provider>
  );
};

export const useVolumeContext = () => {
  const context = useContext(VolumeContext);
  if (context === undefined) {
    throw new Error('useVolumeContext must be used within a VolumeProvider');
  }
  return context;
};
