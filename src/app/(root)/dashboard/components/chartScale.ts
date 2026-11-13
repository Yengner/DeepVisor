// Readable axis maxima (× power of ten) and how many even intervals each divides into.
const STEPS: ReadonlyArray<[number, number]> = [[1, 5], [2, 4], [2.5, 5], [4, 4], [5, 5], [6, 3], [8, 4], [10, 5]];
const HEADROOM = 1.5;

/** Leave visible headroom above the highest point, rounded to a readable axis maximum. */
export function chartCeiling(max: number) {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const target = max * HEADROOM;
  const scale = 10 ** Math.floor(Math.log10(target));
  return Number(((STEPS.find(([m]) => m * scale >= target)?.[0] ?? 10) * scale).toPrecision(12));
}

/** Evenly spaced ticks from 0 to the ceiling, so labels never land on uneven values. */
export function chartTicks(ceiling: number) {
  const lead = Number((ceiling / 10 ** Math.floor(Math.log10(ceiling))).toPrecision(12));
  const intervals = STEPS.find(([m]) => m === lead)?.[1] ?? 5;
  return Array.from({ length: intervals + 1 }, (_, i) =>
    Number(((ceiling / intervals) * i).toPrecision(12)),
  );
}
