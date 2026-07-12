import { smepostClient } from "@/features/smepost/client";
import { fail, failFromError, ok, parseJson } from "@/lib/api";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startSchema = z.object({
  baseUrl: z.string().url().optional(),
  deviceName: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const parsed = await parseJson(request, startSchema);
  if (parsed.error) {
    return fail("INVALID_PAYLOAD", 400, parsed.error);
  }

  try {
    return ok(await smepostClient.startDeviceLogin(parsed.data));
  } catch (error) {
    return failFromError(error, "SMEPOST_LOGIN_FAILED", 502);
  }
}
