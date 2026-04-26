import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../lib/api';
import { getErrorMessage } from '../utils/errors';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: number | null;
  email: string | null;
  username: string | null;
  imageUrl: string | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfileImage: (image_url?: string) => Promise<{ error: any }>;
  deleteAccount: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = 'geschenk.auth_token';
const USER_KEY = 'geschenk.auth_user';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const setUserState = (user: { id: number; email?: string | null; username: string; image_url?: string | null }) => {
    setIsAuthenticated(true);
    setUserId(user.id);
    setEmail(user.email || null);
    setUsername(user.username);
    setImageUrl(user.image_url || null);
  };

  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    apiClient.setToken(null);
    setIsAuthenticated(false);
    setUserId(null);
    setEmail(null);
    setUsername(null);
    setImageUrl(null);
  };

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const userStr = localStorage.getItem(USER_KEY);
      if (!token || !userStr) return;

      apiClient.setToken(token);
      const response = await apiClient.getMe();
      if (response.data) {
        const user = response.data.user;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        setUserState(user);
      } else {
        clearAuth();
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password);
      if (response.error) {
        return { error: { message: response.appError?.userMessage || response.error } };
      }
      if (response.data) {
        const { token, user } = response.data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        apiClient.setToken(token);
        setUserState(user);
      }
      return { error: null };
    } catch (error) {
      return { error: { message: getErrorMessage(error) } };
    }
  };

  const signUp = async (email: string, username: string, password: string) => {
    try {
      const response = await apiClient.register(email, username, password);
      if (response.error) {
        return { error: { message: response.appError?.userMessage || response.error } };
      }
      if (response.data) {
        const { token, user } = response.data;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        apiClient.setToken(token);
        setUserState(user);
      }
      return { error: null };
    } catch (error) {
      return { error: { message: getErrorMessage(error) } };
    }
  };

  const updateProfileImage = async (image_url?: string) => {
    try {
      const response = await apiClient.updateProfileImage(image_url);
      if (response.error) {
        return { error: { message: response.appError?.userMessage || response.error } };
      }
      if (response.data) {
        const { user } = response.data;
        setImageUrl(user.image_url || null);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      return { error: null };
    } catch (error) {
      return { error: { message: getErrorMessage(error) } };
    }
  };

  const signOut = async () => {
    clearAuth();
  };

  const deleteAccount = async () => {
    try {
      const response = await apiClient.deleteAccount();
      if (response.error) {
        return { error: { message: response.appError?.userMessage || response.error } };
      }
      clearAuth();
      return { error: null };
    } catch (error) {
      return { error: { message: getErrorMessage(error) } };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userId,
        email,
        username,
        imageUrl,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateProfileImage,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
