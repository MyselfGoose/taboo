import { cn } from "../../lib/cn";

const variantClasses = {
  primary:
    "bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white hover:from-[#2a4d7a] hover:to-[#3b6ca8] shadow-lg shadow-[#1e3a5f]/20",
  secondary:
    "bg-gradient-to-r from-[#b73b3b] to-[#c94d4d] text-white hover:from-[#c94d4d] hover:to-[#d65d5d] shadow-lg shadow-[#b73b3b]/20",
  ghost:
    "bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08]",
  success:
    "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30",
  danger:
    "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30",
  warning:
    "bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:bg-amber-500/30",
};

const sizeClasses = {
  sm: "h-10 px-4 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-sm sm:h-13",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  children,
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0",
        sizeClasses[size] || sizeClasses.md,
        variantClasses[variant] || variantClasses.primary,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
