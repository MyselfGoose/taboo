const TAB_TAG_KEY = "taboo-tab-tag";

export function getOrCreateTabTag() {
  const existing = window.sessionStorage.getItem(TAB_TAG_KEY);
  if (existing) {
    return existing;
  }

  const generated = `TAB-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  window.sessionStorage.setItem(TAB_TAG_KEY, generated);
  return generated;
}
