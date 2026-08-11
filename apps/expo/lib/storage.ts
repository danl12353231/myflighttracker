import * as SecureStore from 'expo-secure-store';

const SERVER_URL_KEY = 'mft.serverUrl';
const TOKEN_KEY = 'mft.token';

export const getServerUrl = async (): Promise<string | null> =>
  SecureStore.getItemAsync(SERVER_URL_KEY);

export const setServerUrl = async (url: string): Promise<void> => {
  await SecureStore.setItemAsync(SERVER_URL_KEY, url);
};

export const clearServerUrl = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(SERVER_URL_KEY);
};

export const getToken = async (): Promise<string | null> =>
  SecureStore.getItemAsync(TOKEN_KEY);

export const setToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
};

export const clearToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
};

export const normalizeServerUrl = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};
