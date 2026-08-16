import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { isValidPin, normalizeEmail } from '@/shared';
import { supabase } from '../lib/supabase';
import type { User } from './AppContext';

interface AuthState {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  loginAsTestUser: (role: User['role']) => void;
  logout: () => Promise<void>;
  updatePin: (currentPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then((result) => {
      const { session } = result.data;
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, session: { user: { id: string } } | null) => {
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    if (data && !error) {
      setCurrentUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as User['role'],
        serviceId: data.service_id,
        pin: data.pin,
        lastLogin: data.last_login,
        active: data.active !== false,
        photo: data.photo || undefined,
        posReturnsEnabled: data.pos_returns_enabled === true,
        posCatalogueEnabled: data.pos_catalogue_enabled === true,
        posSupplyEnabled: data.pos_supply_enabled === true,
        posInventoryEnabled: data.pos_inventory_enabled === true,
        posStockEnabled: data.pos_stock_enabled === true
      });
    }
    setLoading(false);
  };

  const login = async (emailInput: string, pinInput: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    const cleanEmail = normalizeEmail(emailInput);
    const cleanPin = pinInput.trim();

    if (!isValidPin(cleanPin)) {
      setLoading(false);
      return { success: false, error: 'Le mot de passe ne peut pas être vide.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: cleanEmail, 
      password: cleanPin 
    });
    
    if (error || !data.user) {
      console.error('[AuthContext] Connexion échouée :', error?.message);
      setLoading(false);
      return { success: false, error: error?.message || 'Utilisateur introuvable.' };
    }
    
    // Check active status
    const { data: profile } = await supabase.from('profiles').select('active').eq('id', data.user.id).single();
    if (profile && profile.active === false) {
      await supabase.auth.signOut();
      setLoading(false);
      return { success: false, error: 'Votre compte a été désactivé par le Directeur.' };
    }
    
    // Update last_login
    await supabase.from('profiles').update({ last_login: new Date().toISOString() }).eq('id', data.user.id);
    
    // fetchUserProfile is triggered by onAuthStateChange
    return { success: true };
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
      posReturnsEnabled: true, // test user has everything enabled by default
      posCatalogueEnabled: true,
    };
    setCurrentUser(testUser);
    setLoading(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const updatePin = async (currentPin: string, newPin: string): Promise<{ success: boolean; error?: string }> => {
    if (!currentUser) return { success: false, error: 'Non connecté' };
    if (!isValidPin(newPin)) return { success: false, error: 'Le nouveau PIN doit contenir exactement 6 chiffres.' };
    if (currentPin !== currentUser.pin) return { success: false, error: 'Code PIN actuel incorrect.' };

    // Update Supabase Auth password
    const { error: authError } = await supabase.auth.updateUser({ password: newPin });
    if (authError) return { success: false, error: authError.message };

    // Update pin field in profiles table
    const { error: profileError } = await supabase.from('profiles').update({ pin: newPin }).eq('id', currentUser.id);
    if (profileError) return { success: false, error: profileError.message };

    // Refresh local user
    await fetchUserProfile(currentUser.id);
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ currentUser, loading, login, loginAsTestUser, logout, updatePin }}>
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
