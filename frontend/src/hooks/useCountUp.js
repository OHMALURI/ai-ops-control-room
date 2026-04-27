import { useState, useEffect, useRef } from "react";

export default function useCountUp(target, duration = 800) {
  const [count, setCount] = useState(0);
  const prev = useRef(0);

  useEffect(() => {
    const start = prev.current;
    const end = target ?? 0;
    if (start === end) return;

    const startTime = performance.now();
    let raf;

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prev.current = end;
      }
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return count;
}
