import { useLayoutEffect, useState } from 'react';

/**
 * Whether a scrolling box has anything left above it and below it.
 *
 * What it is for is the pair of fades at the edges of the move list: a box that
 * scrolls has to say so, and the only honest way to say it is to show that the
 * content runs past the edge. So each end answers for itself — at the top of the
 * list there is nothing above, and the fade there would be a mark drawn over
 * content that is all there.
 *
 * The single pixel of slack is for fractional scroll positions: a list scrolled
 * to the bottom lands on `scrollHeight - clientHeight` give or take a rounding
 * error, and without it the bottom fade never quite goes out.
 *
 * `contentKey` is anything that changes when the content does — a length is
 * usually it. Scrolling and resizing are watched for; a row appearing is not
 * something either of those reports, and it changes the answer.
 */
export function useScrollEdges(ref, contentKey) {
  const [edges, setEdges] = useState({ top: false, bottom: false });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const max = element.scrollHeight - element.clientHeight;
      const top = element.scrollTop > 1;
      const bottom = element.scrollTop < max - 1;
      // Scrolling fires this on every frame of a drag, and all but two of those
      // frames say what the last one said.
      setEdges((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
    };
    measure();

    element.addEventListener('scroll', measure, { passive: true });
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => {
        element.removeEventListener('scroll', measure);
        window.removeEventListener('resize', measure);
      };
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [ref, contentKey]);

  return edges;
}
