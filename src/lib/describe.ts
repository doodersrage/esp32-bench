// Meta descriptions: search results show about 155 characters, and site
// audits flag anything over 160. Base.astro refuses longer ones at build time.
export const MAX_DESCRIPTION = 155;
/** Search results show about 60 characters of a title. */
export const MAX_TITLE = 60;

/**
 * Shorten text to at most `max` characters: as many whole sentences as fit,
 * or, when even the first sentence is too long, cut at a word with an ellipsis.
 */
export function clipText(text: string, max: number): string {
  if (text.length <= max) return text;
  let kept = "";
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const next = kept ? `${kept} ${sentence}` : sentence;
    if (next.length > max) break;
    kept = next;
  }
  if (kept) return kept;
  const cut = text.lastIndexOf(" ", max - 1);
  return `${text.slice(0, cut > 0 ? cut : max - 1).replace(/[\s,;:]+$/, "")}…`;
}

/** The first of `candidates` that fits, else the last one clipped to fit. */
export function fitDescription(...candidates: string[]): string {
  return candidates.find((c) => c.length <= MAX_DESCRIPTION) ?? clipText(candidates[candidates.length - 1], MAX_DESCRIPTION);
}
