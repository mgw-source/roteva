const API_BASE = import.meta.env.VITE_API_URL || '';

export async function request(path, { token, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, { ...options, headers });
  } catch {
    throw new Error('Could not reach ChatFlow. Check that the server is running.');
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Something went wrong. Please try again.');
  return result;
}