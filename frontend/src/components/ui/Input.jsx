import { cn } from "../../lib/cn";

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "w-full h-11 sm:h-12 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#3b6ca8]/50 focus:bg-white/[0.06] transition-all text-base",
        className,
      )}
      {...props}
    />
  );
}
