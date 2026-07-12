import { redirect } from "next/navigation";
import { localizedPath, type Locale } from "@/lib/i18n-config";

export default async function ScheduleAliasPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  redirect(localizedPath(locale, "/schedules/list"));
}
