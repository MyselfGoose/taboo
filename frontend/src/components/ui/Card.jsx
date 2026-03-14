import { cn } from "../../lib/cn";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        "bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }) {
  return (
    <h2
      className={cn(
        "text-lg font-semibold text-white",
        className,
      )}
      {...props}
    />
  );
}
