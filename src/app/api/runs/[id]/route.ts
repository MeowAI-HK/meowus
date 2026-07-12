import { getRun } from "@/db/repository";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const run = await getRun(id);
  if (!run) {
    return fail("Run not found", 404);
  }
  return ok(run);
}
