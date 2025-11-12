import { parseError, logError, AppError, ErrorType } from '../utils/errors';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  appError?: AppError;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle non-JSON responses
      let data: any;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        try {
          data = await response.json();
        } catch (jsonError) {
          // JSON parsing failed
          const error: AppError = {
            type: ErrorType.API,
            message: 'Invalid response from server',
            originalError: jsonError,
            statusCode: response.status,
            userMessage: 'The server returned an invalid response. Please try again.',
          };
          logError(error, `API.request(${endpoint})`);
          return { error: error.userMessage, appError: error };
        }
      } else {
        // Non-JSON response (e.g., HTML error page)
        const text = await response.text();
        const error: AppError = {
          type: response.status >= 500 ? ErrorType.SERVER : ErrorType.API,
          message: text || `HTTP ${response.status}`,
          originalError: { status: response.status, text },
          statusCode: response.status,
          userMessage: response.status >= 500
            ? 'The server encountered an error. Please try again later.'
            : 'An error occurred. Please try again.',
        };
        logError(error, `API.request(${endpoint})`);
        return { error: error.userMessage, appError: error };
      }

      if (!response.ok) {
        const error: AppError = {
          type: response.status >= 500 ? ErrorType.SERVER : ErrorType.API,
          message: data.error || `HTTP ${response.status}`,
          originalError: { status: response.status, data },
          statusCode: response.status,
          userMessage: data.error || 'An error occurred. Please try again.',
        };
        
        // Override for specific status codes
        if (response.status === 401) {
          error.type = ErrorType.AUTHENTICATION;
          error.userMessage = 'Your session has expired. Please log in again.';
        } else if (response.status === 403) {
          error.type = ErrorType.AUTHORIZATION;
          error.userMessage = 'You do not have permission to perform this action.';
        } else if (response.status === 404) {
          error.type = ErrorType.NOT_FOUND;
          error.userMessage = 'The requested resource was not found.';
        } else if (response.status === 400) {
          error.type = ErrorType.VALIDATION;
          error.userMessage = data.error || 'Please check your input and try again.';
        }
        
        logError(error, `API.request(${endpoint})`);
        return { error: error.userMessage, appError: error };
      }

      return { data };
    } catch (error: any) {
      // Network error or other fetch error
      const appError = parseError(error);
      logError(appError, `API.request(${endpoint})`);
      return { error: appError.userMessage, appError };
    }
  }

  // Auth endpoints
  async register(username: string, password: string, display_name?: string) {
    return this.request<{ token: string; user: { id: number; username: string; display_name: string; image_url?: string | null } }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, password, display_name }),
      }
    );
  }

  async login(username: string, password: string) {
    return this.request<{ token: string; user: { id: number; username: string; display_name: string; image_url?: string | null } }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
  }

  async getMe() {
    return this.request<{ user: { id: number; username: string; display_name: string; image_url?: string | null } }>('/api/auth/me');
  }

  async searchUsers(query: string) {
    return this.request<{ users: { id: number; username: string; display_name: string; image_url?: string | null }[] }>(
      `/api/auth/search?q=${encodeURIComponent(query)}`
    );
  }

  async updateDisplayName(display_name: string) {
    return this.request<{ user: { id: number; username: string; display_name: string; image_url?: string | null } }>(
      '/api/auth/profile/display-name',
      {
        method: 'PUT',
        body: JSON.stringify({ display_name }),
      }
    );
  }

  async updateProfileImage(image_url?: string) {
    return this.request<{ user: { id: number; username: string; display_name: string; image_url?: string | null } }>(
      '/api/auth/profile/image',
      {
        method: 'PUT',
        body: JSON.stringify({ image_url }),
      }
    );
  }

  async deleteAccount() {
    return this.request<{ message: string }>('/api/auth/account', {
      method: 'DELETE',
    });
  }

  async registerDeviceToken(device_token: string, platform: string) {
    return this.request<{ message: string }>(
      '/api/auth/device-token',
      {
        method: 'POST',
        body: JSON.stringify({ device_token, platform }),
      }
    );
  }

  // Groups endpoints
  async getGroups() {
    return this.request<{ groups: any[] }>('/api/groups');
  }

  async getGroup(id: number) {
    return this.request<{ group: any }>(`/api/groups/${id}`);
  }

  async createGroup(name: string, description?: string, image_url?: string) {
    return this.request<{ group: any }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description, image_url }),
    });
  }

  async updateGroup(id: number, image_url?: string) {
    return this.request<{ group: any }>(`/api/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ image_url }),
    });
  }

  async deleteGroup(id: number) {
    return this.request<{ message: string }>(`/api/groups/${id}`, {
      method: 'DELETE',
    });
  }

  // Invitation endpoints
  async inviteUserToGroup(groupId: number, username: string) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async getPendingInvitations() {
    return this.request<{ invitations: any[] }>('/api/groups/invitations/pending');
  }

  async acceptInvitation(invitationId: number) {
    return this.request<{ message: string }>(`/api/groups/invitations/${invitationId}/accept`, {
      method: 'POST',
    });
  }

  async rejectInvitation(invitationId: number) {
    return this.request<{ message: string }>(`/api/groups/invitations/${invitationId}/reject`, {
      method: 'POST',
    });
  }

  async cancelInvitation(groupId: number, invitationId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }

  async removeMember(groupId: number, userId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/members/${userId}`, {
      method: 'DELETE',
    });
  }

  // Assignment endpoints
  async assignSecretSanta(groupId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/assign`, {
      method: 'POST',
    });
  }

  async getAssignment(groupId: number) {
    return this.request<{ assignment: { receiver_id: number; receiver_username: string; receiver_display_name: string } | null }>(
      `/api/groups/${groupId}/assignment`
    );
  }

  async deleteAssignments(groupId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/assignments`, {
      method: 'DELETE',
    });
  }

  // Gift ideas endpoints
  async createGiftIdea(groupId: number, forUserId: number, idea: string, link?: string) {
    return this.request<{ gift_idea: any }>(`/api/groups/${groupId}/gift-ideas`, {
      method: 'POST',
      body: JSON.stringify({ for_user_id: forUserId, idea, link }),
    });
  }

  async getGiftIdeas(groupId: number, forUserId?: number) {
    const url = forUserId
      ? `/api/groups/${groupId}/gift-ideas?for_user_id=${forUserId}`
      : `/api/groups/${groupId}/gift-ideas`;
    return this.request<{ gift_ideas: any[] }>(url);
  }

  async updateGiftIdea(groupId: number, ideaId: number, idea: string, link?: string) {
    return this.request<{ gift_idea: any }>(`/api/groups/${groupId}/gift-ideas/${ideaId}`, {
      method: 'PUT',
      body: JSON.stringify({ idea, link }),
    });
  }

  async deleteGiftIdea(groupId: number, ideaId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/gift-ideas/${ideaId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_URL);

