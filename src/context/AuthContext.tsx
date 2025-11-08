import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signUp: (username: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const TOKEN_KEY = '@auth_token';
const USER_KEY = '@auth_user';

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userId, setUserId] = useState<number | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      const userStr = await AsyncStorage.getItem(USER_KEY);

      if (token && userStr) {
        apiClient.setToken(token);
        const user = JSON.parse(userStr);
        
        // Verify token is still valid
        const response = await apiClient.getMe();
        if (response.data) {
          setIsAuthenticated(true);
          setUserId(user.id);
          setUsername(user.username);
        } else {
          // Token invalid, clear storage
          await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
          apiClient.setToken(null);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
      await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
      apiClient.setToken(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      const response = await apiClient.login(username, password);
      
      if (response.error) {
        return { error: { message: response.error } };
      }

      if (response.data) {
        const { token, user } = response.data;
        
        // Store token and user
        await AsyncStorage.setItem(TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        apiClient.setToken(token);

        setIsAuthenticated(true);
        setUserId(user.id);
        setUsername(user.username);
      }

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Login failed' } };
    }
  };

  const signUp = async (username: string, password: string) => {
    try {
      const response = await apiClient.register(username, password);
      
      if (response.error) {
        return { error: { message: response.error } };
      }

      if (response.data) {
        const { token, user } = response.data;
        
        // Store token and user
        await AsyncStorage.setItem(TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
        apiClient.setToken(token);

        setIsAuthenticated(true);
        setUserId(user.id);
        setUsername(user.username);
      }

      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Registration failed' } };
    }
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    apiClient.setToken(null);
    setIsAuthenticated(false);
    setUserId(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userId,
        username,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

