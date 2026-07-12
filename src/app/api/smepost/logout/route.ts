import { clearSMEPostAuth } from "@/lib/smepost-auth";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSMEPostAuth();
  return ok({ disconnected: true });
}
