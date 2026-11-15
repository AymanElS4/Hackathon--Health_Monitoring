import { useEffect, useState } from 'react';
import { REDUCED_MOTION_QUERY } from '../../config/constants';

/** The media query list for the reduced-motion preference, or `null` where `matchMedia` is missing. */
function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

/** True while the user prefers reduced motion; follows changes of the preference. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => reducedMotionQuery()?.matches ?? false);

  useEffect(() => {
    const query = reducedMotionQuery();
    if (query === null) return undefined;
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}
