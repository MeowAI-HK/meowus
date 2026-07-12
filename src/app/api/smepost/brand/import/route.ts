import { updateBrandSettings } from "@/db/repositories/settings";
import { smepostClient } from "@/features/smepost/client";
import { readSMEPostAuth, writeSMEPostAuth } from "@/features/smepost/storage";
import { fail, failFromError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await readSMEPostAuth();
  if (!auth) {
    return fail("SMEPost is not connected", 401);
  }

  try {
    const status = await smepostClient.getRunnerStatus(auth);
    const cloudBrand = status.org.brand;

    const settings = await updateBrandSettings({
      name: cloudBrand?.name || status.org.name || "",
      description: cloudBrand?.description || "",
      colors: {
        primary: cloudBrand?.colors?.primary || "",
        accent: cloudBrand?.colors?.accent || "",
        background: cloudBrand?.colors?.background || "",
      },
    });

    await writeSMEPostAuth({
      ...auth,
      org: {
        ...auth.org,
        ...status.org,
      },
      deviceName: status.runner.deviceName || auth.deviceName,
      userId: status.runner.userId || auth.userId,
    });

    return ok({
      ...settings,
      logoUrl: settings.logoPath ? "/api/settings/brand/logo" : "",
    });
  } catch (error) {
    return failFromError(error);
  }
}
