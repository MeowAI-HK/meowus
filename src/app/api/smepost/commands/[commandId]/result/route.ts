import { fail, ok, parseJson } from "@/lib/api";
import { smepostClient } from "@/features/smepost/client";
import { readSMEPostAuth } from "@/features/smepost/storage";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const resultSchema = z.object({
  ok: z.boolean(),
  result: z.record(z.string(), z.unknown()).optional(),
  error: z.string().optional(),
});

interface RouteContext {
  params: Promise<{ commandId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await readSMEPostAuth();
  if (!auth) {
    return fail("SMEPOST_NOT_CONNECTED", 401);
  }

  const parsed = await parseJson(request, resultSchema);
  if (parsed.error) {
    return fail("INVALID_PAYLOAD", 400, parsed.error);
  }

  const { commandId } = await context.params;
  const result = await smepostClient.callCommand(
    auth,
    `/api/auto-post/runners/${encodeURIComponent(auth.runnerId)}/commands/${encodeURIComponent(commandId)}/result`,
    {
      method: "POST",
      body: JSON.stringify(parsed.data),
    },
  );

  return ok(result);
}
