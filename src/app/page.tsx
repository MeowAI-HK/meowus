import { redirect } from "next/navigation";
import { defaultLocale, localizedPath } from "@/lib/i18n-config";

export default function Home() {
  redirect(localizedPath(defaultLocale, "/dashboard"));
}
