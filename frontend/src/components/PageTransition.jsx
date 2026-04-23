import { useRef } from "react";

const KEYFRAMES = `
  @keyframes pt-fade-up {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pt-slide-left {
    from { opacity: 0; transform: translateX(-26px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes pt-drop {
    from { opacity: 0; transform: translateY(-18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pt-stream {
    from { opacity: 0; transform: translateY(-10px) scaleY(0.97); transform-origin: top center; }
    to   { opacity: 1; transform: translateY(0)    scaleY(1);    transform-origin: top center; }
  }
  @keyframes pt-slide-right {
    from { opacity: 0; transform: translateX(26px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes pt-scale-fade {
    from { opacity: 0; transform: scale(0.965); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes pt-rise {
    from { opacity: 0; transform: translateY(30px) scale(0.978); }
    to   { opacity: 1; transform: translateY(0)    scale(1); }
  }
`;

// Maps each route to { animation-name, duration, easing }
// easing: expo-out feel — fast settle, no overshoot
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const VARIANT_ANIM = {
  "fade-up":    `pt-fade-up    0.38s ${EASING} both`,
  "slide-left": `pt-slide-left 0.36s ${EASING} both`,
  "drop":       `pt-drop       0.32s ${EASING} both`,
  "stream":     `pt-stream     0.38s ${EASING} both`,
  "slide-right":`pt-slide-right 0.36s ${EASING} both`,
  "scale-fade": `pt-scale-fade 0.3s  ${EASING} both`,
  "rise":       `pt-rise       0.4s  ${EASING} both`,
};

export default function PageTransition({ children, variant = "fade-up" }) {
  const injected = useRef(false);
  if (!injected.current) {
    injected.current = true;
  }

  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ animation: VARIANT_ANIM[variant] ?? VARIANT_ANIM["fade-up"] }}>
        {children}
      </div>
    </>
  );
}
