import { getBrandSettings, updateBrandSettings } from "@/db/repositories/settings";
import { fail, failFromError, ok, parseJson } from "@/lib/api";
import { brandSettingsSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responseSettings(settings: Awaited<ReturnType<typeof getBrandSettings>>) {
  return {
    ...settings,
    logoUrl: settings.logoPath ? "/api/settings/brand/logo" : "",
  };
}

export async function GET() {
  try {
    return ok(responseSettings(await getBrandSettings()));
  } catch (error) {
    return failFromError(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseJson(request, brandSettingsSchema);
  if (parsed.error) return fail("INVALID_PAYLOAD", 400, parsed.error);
  try {
    return ok(responseSettings(await updateBrandSettings(parsed.data)));
  } catch (error) {
    return failFromError(error);
  }
}
