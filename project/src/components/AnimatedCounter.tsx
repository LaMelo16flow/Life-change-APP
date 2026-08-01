import { useEffect, useRef, useState } from 'react';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatFn?: (n: number) => string;
  className?: string;
}

export function AnimatedCounter({
  value,
  duration = 800,
  formatFn,
  className = '',
}: AnimatedCounterProps) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);
  const frameRef = useRef<number>(0);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) {
      setDisplay(to);
      return;
    }

    setFlash(true);
    const timeout = setTimeout(() => setFlash(false), 600);

    const startTime = performance.now();
    const diff = to - from;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + diff * eased);
      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frameRef.current);
      clearTimeout(timeout);
    };
  }, [value, duration]);

  const formatted = formatFn ? formatFn(display) : display.toLocaleString();

  return (
    <span
      className={`inline-block transition-all duration-300 ${
        flash ? 'scale-110 text-brand-600' : 'scale-100'
      } ${className}`}
    >
      {formatted}
    </span>
  );
}
