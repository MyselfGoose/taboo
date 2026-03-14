import { cn } from "../../lib/cn";

const variants = {
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger: "bg-red-500/10 text-red-400",
  neutral: "bg-white/[0.06] text-neutral-400",
};

export function StatusPill({ variant = "neutral", className, children, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        variants[variant] || variants.neutral,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
