import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import {
  AppError,
  appErrorMessage,
  isAppErrorCode,
  toApiErrorShape,
  type ApiErrorShape,
  type AppErrorCode,
} from "@/lib/app-errors";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(code: AppErrorCode, status?: number, details?: unknown): NextResponse;
export function fail(message: string, status?: number, details?: unknown): NextResponse;
export function fail(input: string, status = 400, details?: unknown) {
  const isCode = isAppErrorCode(input);
  const error: ApiErrorShape = {
    code: isCode ? input : "UNKNOWN_ERROR",
    message: isCode ? appErrorMessage(input) : input,
    details,
  };
  return NextResponse.json({ ok: false, error: error.message, ...error }, { status });
}

export function failFromError(error: unknown, fallbackCode: AppErrorCode = "UNKNOWN_ERROR", status = 500) {
  const shape = toApiErrorShape(error, fallbackCode);
  const responseStatus = error instanceof AppError ? error.status : status;
  return NextResponse.json({ ok: false, error: shape.message, ...shape }, { status: responseStatus });
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>) {
  try {
    const body = await request.json();
    return { data: schema.parse(body), error: null as null };
  } catch (error) {
    if (error instanceof ZodError) {
      return { data: null, error };
    }
    return { data: null, error: new AppError("INVALID_JSON", { status: 400 }) };
  }
}
