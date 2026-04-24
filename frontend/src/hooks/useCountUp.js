import { useState, useEffect, useRef } from "react";

/**
 * Animates from 0 → target over `duration` ms (ease-out cubic).
 * Re-triggers whenever `target` changes to a new non-zero value.
 */
export default function useCountUp(target, duration = 1000) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null || isNaN(target)) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (target === 0) { setCount(0); return; }

    let start = null;

    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setCount(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setCount(target);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return count;
}
