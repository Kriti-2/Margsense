import { useState, useEffect } from 'react';

/**
 * Returns true when the viewport width is at or below the given breakpoint.
 * Uses matchMedia for efficient, debounce-free updates.
 *
 * @param {number} breakpoint  CSS-pixel width (default 768 = md)
 */
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    // Set initial value from media query
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

/**
 * Simple non-reactive check — useful inside useEffect or event handlers
 * where you don't need re-renders on resize.
 */
export function checkIsMobile(breakpoint = 768) {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < breakpoint;
}
