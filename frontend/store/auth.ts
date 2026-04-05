import { create } from 'zustand';

interface User {
  id: string;
  walletAddress: string;
  role: string;
  daoLevel: number;
  reputationScore: number;
  onboardingCompleted: boolean;
  targetRole?: string;
  nickname?: string;
  name?: string;
}

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('skillstamp_token') : null,
  isLoading: false,

  setAuth: (user, token) => {
    localStorage.setItem('skillstamp_token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('skillstamp_token');
    set({ user: null, token: null });
  },

  setUser: (user) => set({ user }),
}));
