import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const TOKEN_STORAGE_KEY = 'moon_tech_token';
export const USER_STORAGE_KEY = 'moon_tech_user';

// Raised exactly once when an authenticated request is rejected with 401.
// The AuthProvider listens for it and ends the session through React state,
// which lets the router redirect without a hard reload or a redirect loop.
export const SESSION_EXPIRED_EVENT = 'moon-tech:session-expired';

export const clearStoredSession = () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach the bearer token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle an expired / invalid session globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status: number | undefined = error?.response?.status;
    const url = String(error?.config?.url || '');
    // A wrong password on the login form is also a 401 - that is not an expired session
    const isLoginRequest = url.includes('/auth/login');

    if (status === 401 && !isLoginRequest) {
      // Only the first 401 clears the session and notifies; concurrent failures are ignored
      const hadToken = !!localStorage.getItem(TOKEN_STORAGE_KEY);
      clearStoredSession();
      if (hadToken) {
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }

    return Promise.reject(error);
  }
);
