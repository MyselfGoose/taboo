import { AnimatePresence, motion } from "framer-motion";

import { feedbackMotion } from "../../theme/motion";

const Motion = motion;
import { cn } from "../../lib/cn";

const VARIANT_STYLES = {
  correct:
    "bg-gradient-to-b from-emerald-500/[0.14] via-emerald-600/[0.06] to-transparent",
  taboo: "bg-gradient-to-b from-red-500/[0.16] via-red-600/[0.07] to-transparent",
  close: "bg-gradient-to-b from-amber-500/[0.12] via-amber-600/[0.05] to-transparent",
  review_reverted:
    "bg-gradient-to-b from-sky-500/[0.12] via-sky-600/[0.05] to-transparent",
  review_upheld:
    "bg-gradient-to-b from-neutral-500/[0.1] via-neutral-700/[0.04] to-transparent",
};

/**
 * Full-viewport non-interactive pulse for major game moments.
 * @param {{ variant: keyof VARIANT_STYLES | null; reduceMotion: boolean }} props
 */
export function GameFeedbackOverlay({ variant, reduceMotion }) {
  const show = Boolean(variant) && VARIANT_STYLES[variant];

  return (
    <AnimatePresence>
      {show && (
        <Motion.div
          key={variant}
          className={cn(
            "pointer-events-none fixed inset-0 z-[45]",
            VARIANT_STYLES[variant],
          )}
          initial={reduceMotion ? false : feedbackMotion.overlay.initial}
          animate={reduceMotion ? {} : feedbackMotion.overlay.animate}
          exit={reduceMotion ? {} : feedbackMotion.overlay.exit}
          transition={feedbackMotion.overlay.transition}
          aria-hidden
        />
      )}
    </AnimatePresence>
  );
}
