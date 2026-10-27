import React, { useEffect, useRef, useState } from 'react';

const DURATION_MS = 750;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/** Splits "₹1,23,456.78 cr" into prefix "₹", number 123456.78 (2 decimals) and suffix " cr" */
function parse(value: string | number) {
  if (typeof value === 'number') return { prefix: '', number: value, decimals: 0, suffix: '' };
  const match = /^([^\d-]*)(-?[\d,]+(?:\.(\d+))?)(.*)$/.exec(value);
  if (!match) return null;
  const number = Number(match[2].replace(/,/g, ''));
  if (!Number.isFinite(number)) return null;
  return { prefix: match[1], number, decimals: match[3]?.length ?? 0, suffix: match[4] };
}

function format(n: number, decimals: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Shows a number (or an amount like "₹1,23,456.00") that counts up smoothly to its value, and
 * glides from the old value when it changes. Text that is not a number is shown as is.
 */
export const CountUp: React.FC<{ value: string | number }> = ({ value }) => {
  const parsed = parse(value);
  const target = parsed?.number ?? 0;
  const [current, setCurrent] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    if (!parsed) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      fromRef.current = target;
      setCurrent(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const next = from + (target - from) * easeOutCubic(t);
      fromRef.current = next;
      setCurrent(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (!parsed) return <>{value}</>;
  return (
    <>
      {parsed.prefix}
      {format(current, parsed.decimals)}
      {parsed.suffix}
    </>
  );
};
