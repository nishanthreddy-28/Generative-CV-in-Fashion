export class ApiError extends Error {
  readonly status?: number;
  readonly kind?: "cancelled" | "timeout" | "network" | "unavailable";
  constructor(message: string, status?: number, kind?: ApiError["kind"]) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.kind = kind;
  }
}
function configuredBaseUrl(){
  // Browser preview can target its local API without changing the phone tunnel.
  return ((typeof document!=="undefined" ? process.env.EXPO_PUBLIC_WEB_API_URL : undefined)
    || process.env.EXPO_PUBLIC_API_URL)?.trim();
}
export const isApiConfigured = () => Boolean(configuredBaseUrl());
export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
  responseType?: "image";
  timeoutMs?: number;
};
const deadline = 20_000;
const accessRecoveryDeadline = 50_000;
const unavailableMessage = "The service is temporarily unavailable. Wait a moment and try again.";

async function requestOnce<T>(
  url: string,
  options: RequestOptions,
  timeoutMs: number,
  accessRead: boolean,
): Promise<T> {
  const controller = new AbortController();
  const cancelled = () => new ApiError("The request was cancelled.", undefined, "cancelled");
  if (options.signal?.aborted) throw cancelled();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, timeoutMs);
  const multipart = options.body instanceof FormData;
  try {
    const response = await fetch(url, {
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
        : { body: multipart ? (options.body as FormData) : JSON.stringify(options.body) }),
    });
    if ([502, 503, 504].includes(response.status)) {
      throw new ApiError(unavailableMessage, response.status, "unavailable");
    }
    if (!response.ok) {
      const message =
        response.status === 429
          ? "The service is finishing another request. Please try again shortly."
          : response.status === 401
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
      if ([413,415,422].includes(response.status) && new URL(url).pathname === "/ml/garments/analyse-upload") {
        const allowed = new Set([
          "Background removal was uncertain. Choose a clearer garment photo.",
          "The clothing check was uncertain. Choose one garment on a plain background.",
          "That image is too small to analyse. Try a larger photo.",
          "This garment category is not supported for clean wardrobe photos.",
          "The image could not be read. Choose a JPEG, PNG or WebP photo.",
          "Image dimensions exceed the upload limit.",
          "Photo exceeds the 10 MB upload limit.",
          "Choose a single JPEG, PNG or WebP image.",
          "The image could not be decoded safely.",
        ]);
        try {
          const detail:unknown=(await response.json())?.detail;
          if(typeof detail === "string" && allowed.has(detail)) throw new ApiError(detail,response.status);
        } catch(error) { if(error instanceof ApiError) throw error; }
      }
      throw new ApiError(message, response.status);
    }
    if (response.status === 204) return undefined as T;
    const contentType = response.headers.get("content-type") ?? "";
    if (options.responseType === "image") {
      if (!["image/jpeg","image/webp"].includes(contentType.split(";", 1)[0]))
        throw new ApiError("The service returned an unexpected image.");
      return (await response.blob()) as T;
    }
    if (accessRead && contentType.toLowerCase().includes("text/html")) {
      // A hosting wake-up page is not a valid authorization response.
      throw new ApiError(unavailableMessage, undefined, "unavailable");
    }
    if (!contentType.includes("application/json"))
      throw new ApiError("The service returned an unexpected response.");
    return (await response.json()) as T;
  } catch (error) {
    if (options.signal?.aborted) throw cancelled();
    if (controller.signal.aborted) {
      throw new ApiError(
        (options.method ?? "GET") === "GET"
          ? "The service took too long to respond. Try again in a moment."
          : "The request timed out. Refresh to check whether your changes were saved before trying again.",
        undefined, "timeout",
      );
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to connect. Check your connection and try again.", undefined, "network");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = configuredBaseUrl();
  if (!baseUrl)
    throw new ApiError(
      "The service is not connected yet. Your changes have not been saved.",
    );
  if (!path.startsWith("/") || path.startsWith("//"))
    throw new ApiError("Invalid service path.");
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const accessRead = (options.method ?? "GET") === "GET" && options.body === undefined &&
    (path === "/admin/catalog/access" || path === "/account/deletion");
  try {
    const requestDeadline = path.startsWith("/ml/") && Number.isFinite(options.timeoutMs) ? Math.max(1000,Math.min(options.timeoutMs!,330000)) : deadline;
    return await requestOnce<T>(url, options, requestDeadline, accessRead);
  } catch (error) {
    if (!accessRead || !(error instanceof ApiError) ||
        (error.kind !== "timeout" && error.kind !== "unavailable")) throw error;
    // Only the two account access reads may retry, once. A write can commit even
    // if the client never receives its response, so writes are never replayed.
    return requestOnce<T>(url, options, accessRecoveryDeadline, accessRead);
  }
}
export const apiGet = <T>(path: string, signal?: AbortSignal) =>
  apiRequest<T>(path, { signal });
