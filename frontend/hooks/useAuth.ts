import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { authApi } from '../lib/api';

export function useAuth() {
  const { user, token, setAuth, logout, setUser } = useAuthStore();

  useEffect(() => {
    if (token && !user) {
      authApi.getMe()
        .then(setUser)
        .catch(() => logout());
    }
  }, [token]);

  const loginWithWallet = async (walletAddress: string) => {
    const { user, token } = await authApi.loginWithWallet(walletAddress);
    setAuth(user, token);
    return user;
  };

  return { user, token, isAuthenticated: !!token, loginWithWallet, logout };
}
