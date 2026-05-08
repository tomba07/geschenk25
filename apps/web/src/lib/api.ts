import { parseError, logError, AppError, ErrorType } from '../utils/errors';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  appError?: AppError;
}

export interface ApiUser {
  id: number;
  email: string;
  username: string;
  image_url?: string | null;
}

export interface SearchUser {
  id: number;
  username: string;
  image_url?: string | null;
}

export interface Friend {
  id: number;
  username: string;
  image_url?: string | null;
  created_at?: string;
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
    options: RequestInit & { requireAuth?: boolean } = {}
  ): Promise<ApiResponse<T>> {
    const { requireAuth = true, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    if (requireAuth && this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...fetchOptions,
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
  async requestMagicLink(email: string, username?: string) {
    return this.request<{ message: string; expires_in_minutes: number; devMagicLink?: string }>(
      '/api/auth/request-link',
      {
        method: 'POST',
        requireAuth: false,
        body: JSON.stringify({ email, username }),
      }
    );
  }

  async verifyMagicLink(token: string) {
    return this.request<{ token: string; user: ApiUser }>(
      '/api/auth/verify-link',
      {
        method: 'POST',
        requireAuth: false,
        body: JSON.stringify({ token }),
      }
    );
  }

  async loginWithPassword(email: string, password: string) {
    return this.request<{ token: string; user: ApiUser }>(
      '/api/auth/login',
      {
        method: 'POST',
        requireAuth: false,
        body: JSON.stringify({ email, password }),
      }
    );
  }

  async getMe() {
    return this.request<{ user: ApiUser }>('/api/auth/me');
  }

  async searchUsers(query: string) {
    return this.request<{ users: SearchUser[] }>(
      `/api/auth/search?q=${encodeURIComponent(query)}`
    );
  }

  async updateProfileImage(image_url?: string) {
    return this.request<{ user: ApiUser }>(
      '/api/auth/profile/image',
      {
        method: 'PUT',
        body: JSON.stringify({ image_url }),
      }
    );
  }

  async updatePassword(password: string) {
    return this.request<{ message: string }>('/api/auth/profile/password', {
      method: 'PUT',
      body: JSON.stringify({ password }),
    });
  }

  async deleteAccount() {
    return this.request<{ message: string }>('/api/auth/account', {
      method: 'DELETE',
    });
  }

  // Groups endpoints
  async getGroups() {
    return this.request<{ groups: any[] }>('/api/groups');
  }

  async getGroup(id: number) {
    return this.request<{ group: any }>(`/api/groups/${id}`);
  }

  async createGroup(name: string, image_url?: string, member_ids: number[] = []) {
    return this.request<{ group: any }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, image_url, member_ids }),
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

  // Group membership endpoints
  async inviteUserToGroup(groupId: number, userId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  // Friends endpoints
  async getFriends() {
    return this.request<{ friends: Friend[] }>('/api/friends');
  }

  async getFriendInviteLink() {
    return this.request<{ invite_token: string }>('/api/friends/invite-link');
  }

  async getFriendInviteByToken(token: string) {
    return this.request<{ user: Friend }>(`/api/friends/invite/${token}`, { requireAuth: false });
  }

  async joinFriendByToken(token: string) {
    return this.request<{ message: string; friend_id: number }>(`/api/friends/join/${token}`, {
      method: 'POST',
    });
  }

  async removeFriend(friendId: number) {
    return this.request<{ message: string }>(`/api/friends/${friendId}`, {
      method: 'DELETE',
    });
  }

  // Invite link endpoints
  async getInviteLink(groupId: number) {
    return this.request<{ invite_token: string }>(`/api/groups/${groupId}/invite-link`);
  }

  async joinGroupByToken(token: string) {
    return this.request<{ message: string; group_id: number }>(`/api/groups/join/${token}`, {
      method: 'POST',
    });
  }

  async getGroupByInviteToken(token: string) {
    // Public endpoint, no auth required
    return this.request<{ group: { id: number; name: string; description?: string; image_url?: string | null; member_count: number; assignments_created?: boolean } }>(
      `/api/groups/invite/${token}`,
      { requireAuth: false }
    );
  }

  async leaveGroup(groupId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/leave`, {
      method: 'POST',
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
    return this.request<{ assignment: { receiver_id: number; receiver_username: string; receiver_image_url?: string | null; created_at?: string } | null }>(
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

  // Exclusions endpoints
  async getExclusions(groupId: number) {
    return this.request<{ exclusions: any[] }>(`/api/groups/${groupId}/exclusions`);
  }

  async addExclusion(groupId: number, excludedUserId: number, giverId?: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/exclusions`, {
      method: 'POST',
      body: JSON.stringify({ excluded_user_id: excludedUserId, ...(giverId && { giver_id: giverId }) }),
    });
  }

  async removeExclusion(groupId: number, exclusionId: number) {
    return this.request<{ message: string }>(`/api/groups/${groupId}/exclusions/${exclusionId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_URL);
