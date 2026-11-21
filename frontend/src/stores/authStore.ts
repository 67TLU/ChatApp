import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '@/services/api/client';
import type { User, AuthTokens } from '@/types/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (email: string, password: string) => {
        const response = await apiClient.post('/auth/login', { email, password });
        const { accessToken, user } = response.data.data;
        
        set({
          user,
          accessToken,
          isAuthenticated: true,
        });
      },

      register: async (data: any) => {
        const response = await apiClient.post('/auth/register', data);
        // Sau khi register, có thể auto login hoặc redirect to verify email
      },

      logout: () => {
        apiClient.post('/auth/logout').catch(() => {});
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },

      refreshToken: async () => {
        const response = await apiClient.post('/auth/refresh');
        const { accessToken } = response.data.data;
        set({ accessToken });
      },

      setUser: (user: User) => {
        set({ user });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        accessToken: state.accessToken,
        user: state.user ,
        isAuthenticated: state.isAuthenticated, 
      }),
    }
  )
);