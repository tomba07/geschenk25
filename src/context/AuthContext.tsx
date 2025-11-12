import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../lib/api';
import { getErrorMessage, ErrorType } from '../utils/errors';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  displayName: string | null;
  imageUrl: string | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signUp: (username: string, password: string, display_name?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateDisplayName: (display_name: string) => Promise<{ error: any }>;
  updateProfileImage: (image_url?: string) => Promise<{ error: any }>;
  deleteAccount: () => Promise<{ error: any }>;
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
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
          setUserId(response.data.user.id);
          setUsername(response.data.user.username);
          setDisplayName(response.data.user.display_name);
          setImageUrl(response.data.user.image_url || null);
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
        const errorMessage = response.appError?.userMessage || response.error;
        return { error: { message: errorMessage } };
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
        setDisplayName(user.display_name);
        setImageUrl(user.image_url || null);
      }

      return { error: null };
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      return { error: { message: errorMessage } };
    }
  };

  const signUp = async (username: string, password: string, display_name?: string) => {
    try {
      const response = await apiClient.register(username, password, display_name);
      
      if (response.error) {
        const errorMessage = response.appError?.userMessage || response.error;
        return { error: { message: errorMessage } };
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
        setDisplayName(user.display_name);
        setImageUrl(user.image_url || null);
      }

      return { error: null };
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      return { error: { message: errorMessage } };
    }
  };

  const updateDisplayName = async (display_name: string) => {
    try {
      const response = await apiClient.updateDisplayName(display_name);
      
      if (response.error) {
        const errorMessage = response.appError?.userMessage || response.error;
        return { error: { message: errorMessage } };
      }

      if (response.data) {
        const { user } = response.data;
        setDisplayName(user.display_name);
        setImageUrl(user.image_url || null);
        
        // Update stored user data
        const userStr = await AsyncStorage.getItem(USER_KEY);
        if (userStr) {
          const storedUser = JSON.parse(userStr);
          storedUser.display_name = user.display_name;
          storedUser.image_url = user.image_url;
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(storedUser));
        }
      }

      return { error: null };
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      return { error: { message: errorMessage } };
    }
  };

  const updateProfileImage = async (image_url?: string) => {
    try {
      const response = await apiClient.updateProfileImage(image_url);
      
      if (response.error) {
        const errorMessage = response.appError?.userMessage || response.error;
        return { error: { message: errorMessage } };
      }

      if (response.data) {
        const { user } = response.data;
        setImageUrl(user.image_url || null);
        
        // Update stored user data
        const userStr = await AsyncStorage.getItem(USER_KEY);
        if (userStr) {
          const storedUser = JSON.parse(userStr);
          storedUser.image_url = user.image_url;
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(storedUser));
        }
      }

      return { error: null };
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      return { error: { message: errorMessage } };
    }
  };

  const signOut = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
    apiClient.setToken(null);
    setIsAuthenticated(false);
    setUserId(null);
    setUsername(null);
    setDisplayName(null);
    setImageUrl(null);
  };

  const deleteAccount = async () => {
    try {
      const response = await apiClient.deleteAccount();
      
      if (response.error) {
        const errorMessage = response.appError?.userMessage || response.error;
        return { error: { message: errorMessage } };
      }

      // Account deleted successfully, sign out
      await signOut();

      return { error: null };
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      return { error: { message: errorMessage } };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userId,
        username,
        displayName,
        imageUrl,
        isLoading,
        signIn,
        signUp,
        signOut,
        updateDisplayName,
        updateProfileImage,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

