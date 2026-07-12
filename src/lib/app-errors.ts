export const appErrorCodes = [
  "UNKNOWN_ERROR",
  "INVALID_JSON",
  "INVALID_PAYLOAD",
  "NOT_FOUND",
  "UNAUTHORIZED",
  "SMEPOST_NOT_CONNECTED",
  "SMEPOST_LOGIN_FAILED",
  "SMEPOST_API_FAILED",
  "SMEPOST_SESSION_EXPIRED",
  "AI_PROVIDER_MISSING_KEY",
  "AI_PROVIDER_NO_TEXT",
  "AI_PROVIDER_FAILED",
  "AI_STRUCTURED_OUTPUT_INVALID",
] as const;

export type AppErrorCode = (typeof appErrorCodes)[number];

export type ApiErrorShape = {
  code: AppErrorCode;
  message: string;
  details?: unknown;
};

const fallbackMessages: Record<AppErrorCode, string> = {
  UNKNOWN_ERROR: "Unknown error",
  INVALID_JSON: "Invalid JSON body",
  INVALID_PAYLOAD: "Invalid payload",
  NOT_FOUND: "Not found",
  UNAUTHORIZED: "Unauthorized",
  SMEPOST_NOT_CONNECTED: "SMEPost runner is not connected",
  SMEPOST_LOGIN_FAILED: "SMEPost login failed",
  SMEPOST_API_FAILED: "SMEPost API request failed",
  SMEPOST_SESSION_EXPIRED: "SMEPost session expired",
  AI_PROVIDER_MISSING_KEY: "Missing AI provider API key",
  AI_PROVIDER_NO_TEXT: "AI provider returned no text",
  AI_PROVIDER_FAILED: "AI provider request failed",
  AI_STRUCTURED_OUTPUT_INVALID: "AI provider returned invalid structured output",
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: AppErrorCode, options: { message?: string; status?: number; details?: unknown } = {}) {
    super(options.message ?? fallbackMessages[code]);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? 500;
    this.details = options.details;
  }
}

export function isAppErrorCode(value: string): value is AppErrorCode {
  return appErrorCodes.includes(value as AppErrorCode);
}

export function toApiErrorShape(error: unknown, fallbackCode: AppErrorCode = "UNKNOWN_ERROR"): ApiErrorShape {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      code: fallbackCode,
      message: error.message || fallbackMessages[fallbackCode],
    };
  }

  return {
    code: fallbackCode,
    message: fallbackMessages[fallbackCode],
    details: error,
  };
}

export function appErrorMessage(code: AppErrorCode) {
  return fallbackMessages[code];
}
