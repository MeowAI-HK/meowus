import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { smepostClient } from "@/features/smepost/client";
import { readSMEPostAuth } from "@/features/smepost/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await readSMEPostAuth();
  if (!auth) {
    return fail("SMEPOST_NOT_CONNECTED", 401);
  }

  const limit = request.nextUrl.searchParams.get("limit") || "1";
  const result = await smepostClient.callCommand(auth, `/api/auto-post/runners/${encodeURIComponent(auth.runnerId)}/commands?limit=${encodeURIComponent(limit)}`);
  return ok(result);
}
