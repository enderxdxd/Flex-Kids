import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Unit } from '../../../shared/types';

interface UnitContextType {
  currentUnit: string;
  setCurrentUnit: (unit: string) => void;
  units: Unit[];
  getCurrentUnitInfo: () => Unit | undefined;
}

const UNITS: Unit[] = [
  { id: 'alphaville', name: 'Alphaville', active: true },
  { id: 'marista', name: 'Marista', active: true },
  { id: 'palmas', name: 'Palmas', active: true },
  { id: 'buenavista', name: 'Buenavista', active: true },
];

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUnit, setCurrentUnit] = useState<string>('alphaville');

  const getCurrentUnitInfo = () => {
    return UNITS.find(u => u.id === currentUnit);
  };

  return (
    <UnitContext.Provider value={{ currentUnit, setCurrentUnit, units: UNITS, getCurrentUnitInfo }}>
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
