const configuredApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
const sameOriginApiUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/api`;

export const API = (configuredApiUrl || sameOriginApiUrl || '/api').replace(/\/$/, '');

export async function apiFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API}/${path.replace(/^\//, '')}`;
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.clone().json();
      } catch {
        payload = await response.clone().text().catch(() => null);
      }
      console.error('[Vexoryl] API request failed', {
        url,
        method: options.method || 'GET',
        status: response.status,
        statusText: response.statusText,
        payload,
      });
    }
    return response;
  } catch (error) {
    console.error('[Vexoryl] API network request failed', {
      url,
      method: options.method || 'GET',
      error: error instanceof Error ? error.message : error,
    });
    throw error;
  }
}