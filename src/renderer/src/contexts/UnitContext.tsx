import React, { createContext, useContext, useState, ReactNode } from 'react';

interface UnitContextType {
  currentUnit: string;
  setCurrentUnit: (unit: string) => void;
}

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUnit, setCurrentUnit] = useState<string>('unit-1');

  return (
    <UnitContext.Provider value={{ currentUnit, setCurrentUnit }}>
      {children}
    </UnitContext.Provider>
  );
};

export const useUnit = () => {
  const context = useContext(UnitContext);
  if (context === undefined) {
    throw new Error('useUnit must be used within a UnitProvider');
  }
  return context;
};
