import { cn } from "@/lib/utils";

export const consoleInputClass =
  "min-h-10 w-full rounded-2xl border border-sky-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-400";

export function ConsoleCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-sky-100 bg-white p-6 shadow-[0_12px_28px_rgba(37,99,235,0.06)]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function ConsoleSectionHeader({
  icon,
  title,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-sky-100 pb-4", className)}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_10px_24px_-12px_rgba(37,99,235,0.55)]">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function ConsoleNotice({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  const toneClass = tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-800";

  return (
    <div className={cn("flex items-center justify-between rounded-2xl border px-4 py-3 text-sm", toneClass)}>
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-4 font-bold opacity-70 transition hover:opacity-100">×</button>
    </div>
  );
}