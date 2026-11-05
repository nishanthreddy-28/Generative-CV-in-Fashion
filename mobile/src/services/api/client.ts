export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) { super(message); this.name = 'ApiError'; }
}
/** Only public configuration belongs in EXPO_PUBLIC_* variables. Never place secrets here. */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!baseUrl) throw new ApiError('The service is not connected yet.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new ApiError('Unable to load your data. Please try again.', response.status);
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(controller.signal.aborted ? 'The request was cancelled or timed out.' : 'Unable to connect. Check your connection and try again.');
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
