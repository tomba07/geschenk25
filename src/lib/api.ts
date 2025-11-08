const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
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
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.error || 'Request failed' };
      }

      return { data };
    } catch (error: any) {
      return { error: error.message || 'Network error' };
    }
  }

  // Auth endpoints
  async register(username: string, password: string) {
    return this.request<{ token: string; user: { id: number; username: string } }>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
  }

  async login(username: string, password: string) {
    return this.request<{ token: string; user: { id: number; username: string } }>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }
    );
  }

  async getMe() {
    return this.request<{ user: { id: number; username: string } }>('/api/auth/me');
  }

  // Groups endpoints
  async getGroups() {
    return this.request<{ groups: any[] }>('/api/groups');
  }

  async getGroup(id: number) {
    return this.request<{ group: any }>(`/api/groups/${id}`);
  }

  async createGroup(name: string, description?: string) {
    return this.request<{ group: any }>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  }

  async deleteGroup(id: number) {
    return this.request<{ message: string }>(`/api/groups/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient(API_URL);

