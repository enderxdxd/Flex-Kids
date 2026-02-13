import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  authenticatedUnit: string | null;
  login: (unitId: string, password: string) => boolean;
  loginAdmin: (password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Senha por unidade
const UNIT_PASSWORDS: Record<string, string> = {
  alphaville: 'alpha2024',
  marista: 'marista2024',
  palmas: 'palmas2024',
  buenavista: 'buena2024',
};

const ADMIN_PASSWORD = 'pactoflex123';

const AUTH_STORAGE_KEY = 'flex-kids-auth';
const ADMIN_STORAGE_KEY = 'flex-kids-admin';
const AUTH_EXPIRY_HOURS = 8;
const ADMIN_EXPIRY_HOURS = 2;

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const { timestamp } = JSON.parse(stored);
        const now = new Date().getTime();
        const expiryTime = AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        if (now - timestamp < expiryTime) {
          return true;
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading auth state:', error);
    }
    return false;
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored) {
        const { timestamp } = JSON.parse(stored);
        const now = new Date().getTime();
        const expiryTime = ADMIN_EXPIRY_HOURS * 60 * 60 * 1000;
        if (now - timestamp < expiryTime) {
          return true;
        } else {
          localStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error('Error loading admin state:', error);
    }
    return false;
  });

  const [authenticatedUnit, setAuthenticatedUnit] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const { unitId, timestamp } = JSON.parse(stored);
        const now = new Date().getTime();
        const expiryTime = AUTH_EXPIRY_HOURS * 60 * 60 * 1000;
        if (now - timestamp < expiryTime) {
          return unitId || null;
        }
      }
    } catch (error) {
      console.error('Error loading auth unit:', error);
    }
    return null;
  });

  const login = (unitId: string, password: string): boolean => {
    const unitPassword = UNIT_PASSWORDS[unitId];
    if (unitPassword && password === unitPassword) {
      setIsAuthenticated(true);
      setAuthenticatedUnit(unitId);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          timestamp: new Date().getTime(),
          unitId,
        }));
      } catch (error) {
        console.error('Error saving auth state:', error);
      }
      return true;
    }
    // Admin password works for any unit
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      setAuthenticatedUnit(unitId);
      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          timestamp: new Date().getTime(),
          unitId,
        }));
      } catch (error) {
        console.error('Error saving auth state:', error);
      }
      return true;
    }
    return false;
  };

  const loginAdmin = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
          timestamp: new Date().getTime(),
        }));
      } catch (error) {
        console.error('Error saving admin state:', error);
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setAuthenticatedUnit(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing auth state:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, authenticatedUnit, login, loginAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
