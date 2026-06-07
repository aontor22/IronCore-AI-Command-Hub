export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export function compactDate(date?: string | null) {
  if (!date) return 'No due date';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
