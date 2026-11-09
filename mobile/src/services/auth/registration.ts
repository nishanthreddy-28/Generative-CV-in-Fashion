// Independent registration capability, never an Auth access/refresh token.
export type RegistrationBinding = { attemptId: string; capability: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const secret = /^[A-Za-z0-9_-]{43}$/;
export function validBinding(value: unknown): value is RegistrationBinding {
  if (!value || typeof value !== 'object') return false;
  const item = value as RegistrationBinding;
  return uuid.test(item.attemptId) && secret.test(item.capability);
}
export function registrationLink(value: string, origin: string): {attemptId: string; link: string} | null {
  try {
    const url = new URL(value);
    if (url.origin !== origin || url.pathname !== '/verify-registration' || url.search) return null;
    const params = new URLSearchParams(url.hash.slice(1));
    const attemptId = params.get('attempt') ?? '', link = params.get('link') ?? '';
    return uuid.test(attemptId) && secret.test(link) ? {attemptId, link} : null;
  } catch { return null; }
}
export function registrationOrigin(value?: string, localPreview = false): string | null {
  try {
    const url = new URL(value ?? '');
    const protocolAllowed = localPreview ? url.origin === 'http://127.0.0.1:8001' : url.protocol === 'https:';
    return protocolAllowed && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash ? url.origin : null;
  } catch { return null; }
}
export async function registrationRequest<T>(base: string, operation: 'start'|'link'|'verify'|'finalize'|'resend'|'status', body: unknown, localPreview = false): Promise<T> {
  const origin = registrationOrigin(base, localPreview);
  if (!origin) throw new Error('Registration is not available yet.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${origin}/auth/registration/${operation}`, {
      method: 'POST', credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: controller.signal, headers: {'Content-Type':'application/json',Accept:'application/json'}, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(response.status === 429 ? 'Please wait a minute before trying again.' :
      response.status === 400 ? 'This link or code is invalid or expired. Check your email or request a new one.' :
      response.status === 409 ? 'This address already has an account. Sign in or reset your password.' :
      response.status === 422 ? 'Check your email and matching password requirements.' : 'Verification is unavailable. Please try again.');
    if (!response.headers.get('Content-Type')?.includes('application/json')) throw new Error('Unexpected verification response.');
    return await response.json() as T;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError' && error.name !== 'TypeError') throw error;
    throw new Error('Unable to connect. Your verification can be retried.');
  } finally {clearTimeout(timer);}
}
