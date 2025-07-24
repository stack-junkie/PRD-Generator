/**
 * API Client for PRD-Maker application
 * Handles all communication with the backend API
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// API configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Define response types
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: any;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  errors?: any[];
  originalError?: Error;
}

// Create and configure Axios instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_URL,
    timeout: DEFAULT_TIMEOUT,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    withCredentials: true, // Allow credentials for cross-origin requests
  });

  // Request interceptor
  client.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      // Add auth token from localStorage if available
      const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      const apiError: ApiError = {
        message: error.message || 'An unknown error occurred',
        status: error.response?.status,
        originalError: error,
      };

      // Handle specific status codes
      if (error.response) {
        const data = error.response.data as any;
        apiError.message = data.message || apiError.message;
        apiError.code = data.code;
        apiError.errors = data.errors;

        // Handle 401 Unauthorized (session expired)
        if (error.response.status === 401) {
          // Clear auth token and redirect to login if needed
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            // Optional: redirect to login
            // window.location.href = '/login';
          }
        }
      } else if (error.request) {
        // Network error (no response received)
        apiError.message = 'Network error. Please check your connection.';
        apiError.code = 'NETWORK_ERROR';
      }

      return Promise.reject(apiError);
    }
  );

  return client;
};

// Create a default API client instance
export const apiClient = createApiClient();

// Session API methods
export const sessionApi = {
  // Get recent sessions
  getRecentSessions: async (): Promise<ApiResponse<any[]>> => {
    return apiClient.get('/sessions/recent');
  },

  // Get session by ID
  getSession: async (sessionId: string): Promise<ApiResponse<any>> => {
    return apiClient.get(`/sessions/${sessionId}`);
  },

  // Create new session
  createSession: async (data: any): Promise<ApiResponse<any>> => {
    return apiClient.post('/sessions', data);
  },

  // Update session
  updateSession: async (sessionId: string, data: any): Promise<ApiResponse<any>> => {
    return apiClient.put(`/sessions/${sessionId}`, data);
  },

  // Sync session
  syncSession: async (sessionId: string, data: any): Promise<ApiResponse<any>> => {
    return apiClient.put(`/sessions/${sessionId}/sync`, data);
  },

  // Update section content
  updateSection: async (sessionId: string, sectionId: string, data: any): Promise<ApiResponse<any>> => {
    return apiClient.put(`/sessions/${sessionId}/sections/${sectionId}`, data);
  },

  // Export PRD
  exportPRD: async (sessionId: string, format: string, options: any = {}): Promise<ApiResponse<any>> => {
    return apiClient.post(`/sessions/${sessionId}/export`, { format, options });
  },
};

// AI API methods
export const aiApi = {
  // Send message to AI
  sendMessage: async (message: string, sessionId: string, section: string, context: any = {}): Promise<ApiResponse<any>> => {
    return apiClient.post('/ai/message', { message, sessionId, section, context });
  },

  // Stream AI response (returns URL for SSE connection)
  getStreamUrl: (sessionId: string, section: string): string => {
    return `${API_URL}/ai/stream?sessionId=${sessionId}&section=${section}`;
  },

  // Validate content
  validateContent: async (content: string, sectionType: string): Promise<ApiResponse<any>> => {
    return apiClient.post('/ai/validate', { content, sectionType });
  },
};

export default apiClient;