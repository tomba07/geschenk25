/**
 * Error handling utilities for the app
 */

export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

export interface AppError {
  type: ErrorType;
  message: string;
  originalError?: any;
  statusCode?: number;
  userMessage: string;
}

/**
 * Creates a user-friendly error message based on error type
 */
function getUserMessage(type: ErrorType, message: string, statusCode?: number): string {
  switch (type) {
    case ErrorType.NETWORK:
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case ErrorType.AUTHENTICATION:
      return 'Your session has expired. Please log in again.';
    
    case ErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action.';
    
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.';
    
    case ErrorType.VALIDATION:
      return message || 'Please check your input and try again.';
    
    case ErrorType.SERVER:
      return 'The server encountered an error. Please try again later.';
    
    case ErrorType.API:
      // Try to extract a meaningful message from the API error
      if (message.toLowerCase().includes('username')) {
        return 'This username is already taken. Please choose another.';
      }
      if (message.toLowerCase().includes('password')) {
        return 'Invalid password. Please try again.';
      }
      if (message.toLowerCase().includes('invitation')) {
        return 'Unable to send invitation. The user may already be a member or have a pending invitation.';
      }
      if (message.toLowerCase().includes('assignment')) {
        return 'Unable to create assignments. Please ensure there are at least 2 members in the group.';
      }
      return message || 'An error occurred. Please try again.';
    
    case ErrorType.UNKNOWN:
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Parses an error and creates an AppError
 */
export function parseError(error: any): AppError {
  // Network errors (no response from server)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: ErrorType.NETWORK,
      message: error.message,
      originalError: error,
      userMessage: getUserMessage(ErrorType.NETWORK, error.message),
    };
  }

  // Check if it's already an AppError
  if (error && typeof error === 'object' && 'type' in error && 'userMessage' in error) {
    return error as AppError;
  }

  // Check for status code in error object
  const statusCode = error?.statusCode || error?.status || error?.response?.status;

  if (statusCode) {
    switch (statusCode) {
      case 401:
        return {
          type: ErrorType.AUTHENTICATION,
          message: error.message || 'Unauthorized',
          originalError: error,
          statusCode,
          userMessage: getUserMessage(ErrorType.AUTHENTICATION, error.message, statusCode),
        };
      
      case 403:
        return {
          type: ErrorType.AUTHORIZATION,
          message: error.message || 'Forbidden',
          originalError: error,
          statusCode,
          userMessage: getUserMessage(ErrorType.AUTHORIZATION, error.message, statusCode),
        };
      
      case 404:
        return {
          type: ErrorType.NOT_FOUND,
          message: error.message || 'Not found',
          originalError: error,
          statusCode,
          userMessage: getUserMessage(ErrorType.NOT_FOUND, error.message, statusCode),
        };
      
      case 400:
        return {
          type: ErrorType.VALIDATION,
          message: error.message || 'Bad request',
          originalError: error,
          statusCode,
          userMessage: getUserMessage(ErrorType.VALIDATION, error.message, statusCode),
        };
      
      case 500:
      case 502:
      case 503:
      case 504:
        return {
          type: ErrorType.SERVER,
          message: error.message || 'Server error',
          originalError: error,
          statusCode,
          userMessage: getUserMessage(ErrorType.SERVER, error.message, statusCode),
        };
      
      default:
        return {
          type: ErrorType.API,
          message: error.message || 'API error',
          originalError: error,
          statusCode,
          userMessage: getUserMessage(ErrorType.API, error.message, statusCode),
        };
    }
  }

  // Check for error message
  const message = error?.message || error?.error || String(error) || 'Unknown error';

  // Try to determine error type from message
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('connection')) {
    return {
      type: ErrorType.NETWORK,
      message,
      originalError: error,
      userMessage: getUserMessage(ErrorType.NETWORK, message),
    };
  }

  if (message.toLowerCase().includes('unauthorized') || message.toLowerCase().includes('authentication')) {
    return {
      type: ErrorType.AUTHENTICATION,
      message,
      originalError: error,
      userMessage: getUserMessage(ErrorType.AUTHENTICATION, message),
    };
  }

  // Default to API error
  return {
    type: ErrorType.API,
    message,
    originalError: error,
    userMessage: getUserMessage(ErrorType.API, message),
  };
}

/**
 * Logs an error for debugging (can be extended to send to error tracking service)
 */
export function logError(error: AppError, context?: string) {
  const logMessage = context 
    ? `[${context}] ${error.type}: ${error.message}`
    : `${error.type}: ${error.message}`;
  
  console.error(logMessage, {
    type: error.type,
    message: error.message,
    statusCode: error.statusCode,
    originalError: error.originalError,
  });
}

/**
 * Creates a user-friendly error message from any error
 */
export function getErrorMessage(error: any): string {
  const appError = parseError(error);
  return appError.userMessage;
}

