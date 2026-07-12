import { getSite } from "@/db/repository";
import { firstPage, launchSiteProfileContext } from "@/lib/browser";

async function main() {
  const siteId = process.argv[2];
  if (!siteId) {
    throw new Error("Missing siteId");
  }
  const site = await getSite(siteId);
  if (!site) {
    throw new Error(`Site not found: ${siteId}`);
  }

  const context = await launchSiteProfileContext(site.profilePath);
  const page = await firstPage(context);
  await page.goto(site.url || "https://www.threads.net/", {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  console.log(`[open-profile] Opened ${site.name}. Close the browser window when done.`);
  await new Promise<void>((resolve) => context.on("close", () => resolve()));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
