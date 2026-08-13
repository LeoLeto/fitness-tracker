/** Jumps back to the top of the page, honouring the reduced-motion setting. */
export function scrollToTop(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
}
