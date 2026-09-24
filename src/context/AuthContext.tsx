import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { isValidPin, normalizeEmail } from '@/shared';
import { supabase } from '../lib/supabase';
import type { User } from './AppContext';
import { getUserThemeColor, applyTheme } from '../lib/theme';

interface AuthState {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  loginAsTestUser: (role: User['role']) => void;
  logout: () => Promise<void>;
  updatePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  updateCurrentUser: (updates: Partial<User>) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const AUTH_STORAGE_KEY = 'auth_last_user';

// Helper de timeout pour éviter les blocages réseau infinis
const withAuthTimeout = async <T = any,>(promiseOrThenable: any, ms: number = 2500): Promise<T> => {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Délai réseau dépassé')), ms);
  });
  try {
    return await Promise.race([
      Promise.resolve(promiseOrThenable),
      timeoutPromise
    ]);
  } finally {
    clearTimeout(timer);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Récupération synchrone immédiate du dernier profil connecté pour un démarrage 0ms
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  // Si un profil était déjà en cache, l'application est immédiatement interactive
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(AUTH_STORAGE_KEY);
    } catch {
      return true;
    }
  });

  // Appliquer automatiquement le thème de l'utilisateur connecté
  useEffect(() => {
    const userColor = getUserThemeColor(currentUser?.id);
    applyTheme(userColor);
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // Tentative de récupération de la session Supabase avec timeout de 2.5s
        const result = await withAuthTimeout(supabase.auth.getSession(), 2500);
        const session = result?.data?.session;
        if (session && isMounted) {
          await fetchUserProfile(session.user.id);
        } else if (isMounted) {
          // Si aucune session active Supabase et pas d'utilisateur en cache local
          if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
            setCurrentUser(null);
          }
          setLoading(false);
        }
      } catch {
        // Hors-ligne au démarrage : on conserve l'utilisateur en cache s'il existe
        console.warn('[AuthContext] Mode hors-ligne détecté au démarrage.');
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: { user: { id: string } } | null) => {
      if (!isMounted) return;
      if (session) {
        await fetchUserProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async (userId: string) => {
    try {
      // 1. Tenter la récupération en ligne avec un timeout court de 2.5s
      const response = await withAuthTimeout(
        supabase.from('profiles').select('*').eq('id', userId).single(),
        2500
      );
      
      const data = response?.data;
      const error = response?.error;

      if (data && !error) {
        const userObj: User = {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role as User['role'],
          serviceId: data.service_id,
          pin: data.pin,
          lastLogin: data.last_login,
          active: data.active !== false,
          photo: data.photo || undefined,
          geminiApiKey: data.gemini_api_key || undefined,
          posReturnsEnabled: data.pos_returns_enabled === true,
          posCatalogueEnabled: data.pos_catalogue_enabled === true,
          posSupplyEnabled: data.pos_supply_enabled === true,
          posInventoryEnabled: data.pos_inventory_enabled === true,
          posStockEnabled: data.pos_stock_enabled === true,
          posRole: data.pos_role || null
        };

        setCurrentUser(userObj);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
        setLoading(false);
        return;
      }
    } catch {
      console.warn('[AuthContext] Échec réseau lors du chargement du profil, bascule sur le cache local.');
    }

    // 2. Fallback Hors-Ligne immédiat : Lecture depuis IndexedDB ou LocalStorage
    try {
      const { db } = await import('../lib/db');
      const cachedUsers = await db.profiles.getItem<User[]>('data');
      if (cachedUsers) {
        const cachedUser = cachedUsers.find(u => u.id === userId);
        if (cachedUser) {
          setCurrentUser(cachedUser);
          localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cachedUser));
          setLoading(false);
          return;
        }
      }
    } catch (cacheErr) {
      console.error('[AuthContext] Erreur lecture cache profil :', cacheErr);
    }
    
    setLoading(false);
  };

  const login = async (emailInput: string, pinInput: string): Promise<{ success: boolean; error?: string }> => {
    const cleanEmail = normalizeEmail(emailInput);
    const cleanPin = pinInput.trim();

    if (!isValidPin(cleanPin)) {
      return { success: false, error: 'Le mot de passe / code PIN ne peut pas être vide.' };
    }

    // Fonction interne d'authentification hors-ligne de secours
    const attemptOfflineLogin = async (): Promise<{ success: boolean; error?: string }> => {
      try {
        const { db } = await import('../lib/db');
        const cachedUsers = await db.profiles.getItem<User[]>('data');
        if (cachedUsers && cachedUsers.length > 0) {
          const matchedUser = cachedUsers.find(u => 
            normalizeEmail(u.email) === cleanEmail || 
            u.name.toLowerCase() === cleanEmail.toLowerCase()
          );

          if (!matchedUser) {
            return { success: false, error: 'Utilisateur introuvable dans la base locale hors-ligne.' };
          }

          if (matchedUser.active === false) {
            return { success: false, error: 'Ce compte a été désactivé.' };
          }

          if (matchedUser.pin && matchedUser.pin === cleanPin) {
            console.log('[AuthContext] Connexion hors-ligne réussie pour :', matchedUser.name);
            setCurrentUser(matchedUser);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(matchedUser));
            setLoading(false);
            return { success: true };
          } else {
            return { success: false, error: 'Code PIN incorrect (mode hors-ligne).' };
          }
        }
      } catch (err) {
        console.error('[AuthContext] Erreur vérification login hors-ligne :', err);
      }
      return { success: false, error: 'Impossible de se connecter hors-ligne (aucun utilisateur en cache).' };
    };

    // 1. Si déconnecté d'Internet de manière évidente, tenter directement le login hors-ligne
    if (!navigator.onLine) {
      return await attemptOfflineLogin();
    }

    // 2. Tentative de connexion en ligne avec timeout de 3.5s
    try {
      const signInPromise = supabase.auth.signInWithPassword({ 
        email: cleanEmail, 
        password: cleanPin 
      });

      const { data, error } = await withAuthTimeout(signInPromise, 3500);

      if (error || !data?.user) {
        // Si erreur d'identifiants côté serveur
        if (error && (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed'))) {
          return { success: false, error: 'Identifiants ou code PIN incorrects.' };
        }
        // Pour les autres erreurs, tenter le repli hors-ligne
        return await attemptOfflineLogin();
      }

      // Vérifier si le compte est actif
      const profileRes = await withAuthTimeout(
        supabase.from('profiles').select('*').eq('id', data.user.id).single(),
        2500
      ).catch(() => null);

      const profile = profileRes?.data;
      if (profile && profile.active === false) {
        await supabase.auth.signOut().catch(() => {});
        return { success: false, error: 'Votre compte a été désactivé par le Directeur.' };
      }

      // Mettre à jour last_login en tâche de fond non-bloquante
      void supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);
      
      if (profile) {
        const userObj: User = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role as User['role'],
          serviceId: profile.service_id,
          pin: profile.pin,
          lastLogin: new Date().toISOString(),
          active: profile.active !== false,
          photo: profile.photo || undefined,
          geminiApiKey: profile.gemini_api_key || undefined,
          posReturnsEnabled: profile.pos_returns_enabled === true,
          posCatalogueEnabled: profile.pos_catalogue_enabled === true,
          posSupplyEnabled: profile.pos_supply_enabled === true,
          posInventoryEnabled: profile.pos_inventory_enabled === true,
          posStockEnabled: profile.pos_stock_enabled === true,
          posRole: profile.pos_role || null
        };
        setCurrentUser(userObj);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userObj));
      }

      setLoading(false);
      return { success: true };
    } catch {
      // Si timeout ou défaillance réseau -> bascule automatique sur le mode hors-ligne
      console.warn('[AuthContext] Connexion en ligne indisponible, tentative hors-ligne...');
      return await attemptOfflineLogin();
    }
  };

  const loginAsTestUser = (role: User['role']) => {
    const testUser: User = {
      id: 'test-' + role.toLowerCase(),
      name: role === 'Caissier' ? 'Caissier Test' : role === 'Gerant' ? 'Gérant Test' : role + ' Test',
      email: 'test@hinov.com',
      role,
      pin: '000000',
      lastLogin: new Date().toISOString(),
      active: true,
      posReturnsEnabled: true,
      posCatalogueEnabled: true,
    };
    setCurrentUser(testUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(testUser));
    setLoading(false);
  };

  const logout = async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    try {
      await withAuthTimeout(supabase.auth.signOut(), 2000);
    } catch {
      // Ignorer les erreurs réseau à la déconnexion
    }
  };

  const updatePin = async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Non connecté' };
    if (!isValidPin(newPin)) return { success: false, error: 'Le nouveau PIN doit contenir exactement 6 chiffres.' };
    if (currentPin !== currentUser.pin) return { success: false, error: 'Code PIN actuel incorrect.' };

    const updatedUser = { ...currentUser, pin: newPin };
    setCurrentUser(updatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));

    // Mettre à jour en local dans db.profiles
    try {
      const { db } = await import('../lib/db');
      const cached = (await db.profiles.getItem<User[]>('data')) || [];
      const updated = cached.map(u => u.id === currentUser.id ? updatedUser : u);
      await db.profiles.setItem('data', updated);
    } catch {}

    // Synchronisation en ligne si disponible
    if (navigator.onLine) {
      try {
        await supabase.auth.updateUser({ password: newPin });
        await supabase.from('profiles').update({ pin: newPin }).eq('id', currentUser.id);
      } catch (err) {
        console.warn('[AuthContext] Synchro nouveau PIN serveur en attente :', err);
      }
    }
    return { success: true };
  };

  const updateCurrentUser = (updates: Partial<User>) => {
    setCurrentUser(prev => {
      if (!prev) return null;
      const next = { ...prev, ...updates };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, loginAsTestUser, logout, updatePin, updateCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
