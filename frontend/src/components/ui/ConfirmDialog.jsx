import { AnimatePresence, motion } from "framer-motion";

import { cn } from "../../lib/cn";
import { motionPresets } from "../../theme/motion";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <motion.div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-6"
            {...motionPresets.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="confirm-dialog-title"
              className="mb-1 text-lg font-bold text-white"
            >
              {title}
            </h2>
            <p className="mb-5 text-sm text-neutral-400">{description}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 h-11 rounded-xl bg-white/[0.06] text-white text-sm font-medium hover:bg-white/[0.1] transition-all"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cn(
                  "flex-1 h-11 rounded-xl text-sm font-medium transition-all",
                  variant === "danger"
                    ? "bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30"
                    : "bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white hover:from-[#2a4d7a] hover:to-[#3b6ca8]",
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
