/**
 * Jumps back to the top of the page, honouring the reduced-motion setting.
 *
 * Deferred by two frames on purpose. Callers scroll right after saving, and the
 * same update collapses the meal list — so the document gets shorter a moment
 * later. A smooth scroll started against the taller layout is aborted as soon
 * as the browser clamps the scroll position to the new, smaller maximum, which
 * left the page stranded part-way up. Waiting for the re-render to paint means
 * the animation runs against the layout it will actually finish in.
 */
export function scrollToTop(): void {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        window.scrollTo({ top: 0, behavior });
      } catch {
        // Engines without the options overload of scrollTo.
        window.scrollTo(0, 0);
      }
    });
  });
}

/**
 * Brings a just-created row into view, centred so its fields clear the bottom
 * nav. Deferred by the same two frames as `scrollToTop`: the row only has a
 * position in the layout once the render that added it has painted.
 */
export function scrollToElement(el: HTMLElement | null): void {
  if (el === null) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const behavior: ScrollBehavior = reduced ? 'auto' : 'smooth';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ behavior, block: 'center' });
      } catch {
        // Engines without the options overload of scrollIntoView.
        el.scrollIntoView();
      }
    });
  });
}
