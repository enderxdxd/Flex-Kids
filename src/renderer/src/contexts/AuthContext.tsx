import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, getFirebaseFunctions, isFirebaseReady } from '../../../shared/firebase/config';

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  authenticatedUnit: string | null;
  isLoggingIn: boolean;
  isFirebaseAuthenticated: boolean;
  login: (unitId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAdmin: (password: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false);
  const authListenerSet = useRef(false);

  // Observa o estado de autenticação do Firebase Auth.
  // O Firebase persiste a sessão automaticamente (IndexedDB).
  // Se o usuário já logou antes, o onAuthStateChanged vai disparar com o user.
  // Se a sessão expirou ou não existe, dispara com null → força logout.
  useEffect(() => {
    if (authListenerSet.current) return;

    const checkAuth = () => {
      if (!isFirebaseReady()) {
        // Firebase ainda não inicializou, tenta de novo em 500ms
        setTimeout(checkAuth, 500);
        return;
      }

      authListenerSet.current = true;
      const auth = getFirebaseAuth();

      onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('[Auth] Firebase Auth session restored for:', user.uid);
          setIsFirebaseAuthenticated(true);

          // Extrai unitId do UID (formato: "unit-alphaville")
          const unitFromUid = user.uid.replace('unit-', '');
          if (unitFromUid && unitFromUid !== user.uid) {
            setAuthenticatedUnit(unitFromUid);
            setIsAuthenticated(true);
            try {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
                timestamp: new Date().getTime(),
                unitId: unitFromUid,
              }));
            } catch (e) {
              console.error('Error saving auth state:', e);
            }
          }
        } else {
          console.log('[Auth] No Firebase Auth session');
          setIsFirebaseAuthenticated(false);
          // Se localStorage diz autenticado mas Firebase não tem sessão,
          // o usuário precisa fazer login novamente
          if (isAuthenticated) {
            console.log('[Auth] localStorage session invalid, clearing...');
            setIsAuthenticated(false);
            setIsAdmin(false);
            setAuthenticatedUnit(null);
            try {
              localStorage.removeItem(AUTH_STORAGE_KEY);
              localStorage.removeItem(ADMIN_STORAGE_KEY);
            } catch (e) {
              console.error('Error clearing stale auth:', e);
            }
          }
        }
      });
    };

    checkAuth();
  }, []);

  const login = async (unitId: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoggingIn(true);
    try {
      if (!isFirebaseReady()) {
        return { success: false, error: 'Firebase não inicializado. Aguarde e tente novamente.' };
      }

      const functions = getFirebaseFunctions();
      const validatePassword = httpsCallable<
        { unitId: string; password: string },
        { token: string; unitId: string; isAdmin: boolean }
      >(functions, 'validateUnitPassword');

      const result = await validatePassword({ unitId, password });
      const { token, unitId: validatedUnit, isAdmin: isAdminUser } = result.data;

      // Autentica com Firebase Auth usando o custom token
      const auth = getFirebaseAuth();
      await signInWithCustomToken(auth, token);

      setIsFirebaseAuthenticated(true);
      setIsAuthenticated(true);
      setAuthenticatedUnit(validatedUnit);
      if (isAdminUser) {
        setIsAdmin(true);
        try {
          localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
            timestamp: new Date().getTime(),
          }));
        } catch (e) {
          console.error('Error saving admin state:', e);
        }
      }

      try {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
          timestamp: new Date().getTime(),
          unitId: validatedUnit,
        }));
      } catch (e) {
        console.error('Error saving auth state:', e);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      // Erro da Cloud Function vem em error.message
      const message = error?.code === 'functions/permission-denied'
        ? 'Senha incorreta para esta unidade'
        : error?.code === 'functions/invalid-argument'
        ? 'Dados inválidos'
        : error?.message || 'Erro ao fazer login. Verifique sua conexão.';
      return { success: false, error: message };
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginAdmin = async (password: string): Promise<{ success: boolean; error?: string }> => {
    // O loginAdmin re-autentica com a senha admin na unidade atual
    if (!authenticatedUnit) {
      return { success: false, error: 'Nenhuma unidade selecionada' };
    }

    setIsLoggingIn(true);
    try {
      if (!isFirebaseReady()) {
        return { success: false, error: 'Firebase não inicializado.' };
      }

      const functions = getFirebaseFunctions();
      const validatePassword = httpsCallable<
        { unitId: string; password: string },
        { token: string; unitId: string; isAdmin: boolean }
      >(functions, 'validateUnitPassword');

      const result = await validatePassword({ unitId: authenticatedUnit, password });
      const { isAdmin: isAdminUser } = result.data;

      if (!isAdminUser) {
        return { success: false, error: 'Senha de administrador incorreta' };
      }

      setIsAdmin(true);
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify({
          timestamp: new Date().getTime(),
        }));
      } catch (e) {
        console.error('Error saving admin state:', e);
      }

      return { success: true };
    } catch (error: any) {
      console.error('Admin login error:', error);
      const message = error?.code === 'functions/permission-denied'
        ? 'Senha de administrador incorreta'
        : error?.message || 'Erro ao verificar senha admin.';
      return { success: false, error: message };
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    try {
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing admin state:', error);
    }
  };

  const logout = async () => {
    setIsAuthenticated(false);
    setIsAdmin(false);
    setAuthenticatedUnit(null);
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(ADMIN_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing auth state:', error);
    }
    // Sign out do Firebase Auth
    try {
      if (isFirebaseReady()) {
        const auth = getFirebaseAuth();
        await signOut(auth);
      }
    } catch (error) {
      console.error('Error signing out from Firebase:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, isAdmin, authenticatedUnit, isLoggingIn, isFirebaseAuthenticated, login, loginAdmin, logoutAdmin, logout }}>
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
