import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { getBrandSettings, updateBrandSettings } from "@/db/repositories/settings";
import { fail, failFromError, ok } from "@/lib/api";
import { uploadsRoot } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_LOGO_SIZE = 5 * 1024 * 1024;
const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function brandLogoRoot() {
  return path.join(uploadsRoot(), "brand-logos");
}

function containedLogoPath(filePath: string) {
  const root = path.resolve(brandLogoRoot());
  const resolved = path.resolve(filePath);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

async function removeExistingLogo() {
  const current = await getBrandSettings();
  const existing = current.logoPath ? containedLogoPath(current.logoPath) : null;
  if (existing) {
    await fs.rm(existing, { force: true });
  }
}

export async function GET() {
  try {
    const settings = await getBrandSettings();
    const filePath = settings.logoPath ? containedLogoPath(settings.logoPath) : null;
    if (!filePath) return new Response("Not found", { status: 404 });
    const extension = path.extname(filePath).toLowerCase();
    const contentType = extension === ".png"
      ? "image/png"
      : extension === ".webp"
        ? "image/webp"
        : "image/jpeg";
    return new Response(await fs.readFile(filePath), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return fail("INVALID_PAYLOAD", 400);
    const extension = allowedTypes.get(file.type);
    if (!extension || file.size <= 0 || file.size > MAX_LOGO_SIZE) {
      return fail("INVALID_PAYLOAD", 400);
    }

    const root = brandLogoRoot();
    await fs.mkdir(root, { recursive: true });
    await removeExistingLogo();
    const filePath = path.join(root, `brand-logo-${Date.now()}-${nanoid(8)}${extension}`);
    await fs.writeFile(filePath, Buffer.from(await file.arrayBuffer()));
    await updateBrandSettings({ logoPath: filePath });
    return ok({ logoUrl: `/api/settings/brand/logo?v=${Date.now()}` });
  } catch (error) {
    return failFromError(error);
  }
}

export async function DELETE() {
  try {
    await removeExistingLogo();
    await updateBrandSettings({ logoPath: undefined });
    return ok({ success: true });
  } catch (error) {
    return failFromError(error);
  }
}
