export const motionPresets = {
  pageEnter: {
    initial: { opacity: 0, y: -10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25, ease: "easeOut" },
  },
  sectionEnter: (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.25, ease: "easeOut" },
  }),
  cardSwap: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  tabSwapLeft: {
    initial: { opacity: 0, x: -10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
  tabSwapRight: {
    initial: { opacity: 0, x: 10 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
  fadeIn: (delay = 0) => ({
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { delay, duration: 0.2 },
  }),
  playerItem: {
    initial: { opacity: 0, x: -5 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 5 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
  tabooWord: (index) => ({
    initial: { opacity: 0, y: 5 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: index * 0.03, duration: 0.15 },
  }),
  flashOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
  modal: {
    initial: { scale: 0.9, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.9, opacity: 0 },
    transition: { duration: 0.2, ease: "easeOut" },
  },
  staggerSection: (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.25, ease: "easeOut" },
  }),
};
