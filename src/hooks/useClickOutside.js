import { useEffect } from 'react';

/** Calls `handler` on a pointer press outside `ref`, while `active` is true. */
export function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) handler(event);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [active, handler, ref]);
}
