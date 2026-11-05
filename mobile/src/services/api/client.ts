export class ApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
export const isApiConfigured = () =>
  Boolean(process.env.EXPO_PUBLIC_API_URL?.trim());
export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
};
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!baseUrl)
    throw new ApiError(
      "The service is not connected yet. Your changes have not been saved.",
    );
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new ApiError("Invalid service path.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20000);
  const multipart = options.body instanceof FormData;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined && !multipart
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      ...(options.body === undefined
        ? {}
        : {
            body: multipart
              ? (options.body as FormData)
              : JSON.stringify(options.body),
          }),
    });
    if (!response.ok) {
      const message =
        response.status === 401
          ? "Your session has expired. Please sign in again."
          : response.status === 403
            ? "You do not have permission to perform this action."
            : response.status === 404
              ? "This item could not be found."
              : response.status === 409
                ? "This record changed. Reload and try again."
                : response.status === 422
                  ? "The service could not accept these details. Check your entries."
                  : "The service could not complete this request. Please try again.";
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json"))
      throw new ApiError("The service returned an unexpected response.");
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      controller.signal.aborted
        ? "The request was cancelled or timed out. Please try again."
        : "Unable to connect. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
export const apiGet = <T>(path: string, signal?: AbortSignal) =>
  apiRequest<T>(path, { signal });
