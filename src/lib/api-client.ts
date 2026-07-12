import type { ApiErrorShape } from "@/lib/app-errors";
import type { TranslationKey } from "@/lib/locale-resources";

export type ApiResponse<T> =
  | { ok: true; data: T }
  | ({ ok: false; error: string } & Partial<ApiErrorShape>);

export class ApiClientError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(error: { message: string; code?: string; details?: unknown }) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.details = error.details;
  }
}

export function apiErrorTranslationKey(error: unknown, fallback: TranslationKey): TranslationKey {
  if (error instanceof ApiClientError && error.code) {
    return `error_${error.code}` as TranslationKey;
  }
  return fallback;
}

async function readApiResponse<T>(response: Response): Promise<T> {
  let json: ApiResponse<T>;
  try {
    json = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError({
      code: response.ok ? "INVALID_JSON" : "UNKNOWN_ERROR",
      message: response.ok ? "Invalid API response" : `Request failed with ${response.status}`,
    });
  }

  if (!json.ok) {
    throw new ApiClientError({
      code: json.code,
      message: json.message ?? json.error,
      details: json.details,
    });
  }
  return json.data;
}

export async function apiGet<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  return readApiResponse<T>(response);
}

export async function apiPost<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
    ...init,
  });
  return readApiResponse<T>(response);
}

export async function apiPatch<T>(url: string, body: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: JSON.stringify(body),
    ...init,
  });
  return readApiResponse<T>(response);
}

export async function apiDelete<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { method: "DELETE", ...init });
  return readApiResponse<T>(response);
}

export const swrFetcher = apiGet;
