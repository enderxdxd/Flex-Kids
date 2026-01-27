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

const STORAGE_KEY = 'flex-kids-current-unit';

const UnitContext = createContext<UnitContextType | undefined>(undefined);

export const UnitProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Carrega a unidade salva do localStorage ou usa 'alphaville' como padrão
  const [currentUnit, setCurrentUnitState] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && UNITS.find(u => u.id === saved)) {
        return saved;
      }
    } catch (error) {
      console.error('Error loading saved unit:', error);
    }
    return 'alphaville';
  });

  // Função que salva no localStorage quando a unidade muda
  const setCurrentUnit = (unit: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, unit);
      setCurrentUnitState(unit);
    } catch (error) {
      console.error('Error saving unit:', error);
      setCurrentUnitState(unit);
    }
  };

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
