const KEY = 'auth_token';

export const setAuthToken = (token: string | null) => {
  if (!token) localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, token);
};

export const getAuthToken = () => localStorage.getItem(KEY);
