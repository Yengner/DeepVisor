/** Narrowest main area kept beside the assistant so the Overview layout stays readable. */
export const MIN_MAIN_WIDTH = 720;
export const MIN_ASSISTANT_WIDTH = 320;

/**
 * Clamp the assistant panel: at least 320px, at most half the available width, and never
 * so wide that the main area drops below MIN_MAIN_WIDTH (the KPI cards then reflow to two
 * columns without truncating values).
 */
export const assistantWidth = (width: number, available: number) => {
  const max = Math.max(Math.min(MIN_ASSISTANT_WIDTH, available / 2), Math.min(available / 2, available - MIN_MAIN_WIDTH));
  return Math.max(Math.min(MIN_ASSISTANT_WIDTH, available / 2), Math.min(width, max));
};
