import type { AssessmentWindowMetrics, DigestTrendSnapshot, TrackingConfidence } from '../types';

export const ELEVATED_FREQUENCY_THRESHOLD = 3.5;

export function computeTrendSnapshot(input: {
  currentValue: number;
  previousValue: number;
}): DigestTrendSnapshot {
  const deltaAbsolute = Number((input.currentValue - input.previousValue).toFixed(2));
  const deltaPercent =
    input.previousValue > 0
      ? Number((((input.currentValue - input.previousValue) / input.previousValue) * 100).toFixed(2))
      : input.currentValue > 0
        ? 100
        : null;

  let direction: DigestTrendSnapshot['direction'] = 'unknown';
  if (input.currentValue === 0 && input.previousValue === 0) {
    direction = 'flat';
  } else if (Math.abs(deltaAbsolute) < 0.01) {
    direction = 'flat';
  } else if (deltaAbsolute > 0) {
    direction = 'up';
  } else if (deltaAbsolute < 0) {
    direction = 'down';
  }

  return {
    direction,
    deltaAbsolute,
    deltaPercent,
    currentValue: Number(input.currentValue.toFixed(2)),
    previousValue: Number(input.previousValue.toFixed(2)),
  };
}

export function computeTrackingConfidence(
  window: Pick<AssessmentWindowMetrics, 'conversion' | 'linkClicks' | 'clicks'>
): TrackingConfidence {
  if (window.conversion >= 10) {
    return 'high';
  }

  if (window.linkClicks >= 25 && window.conversion >= 2) {
    return 'medium';
  }

  if (window.clicks >= 50 && window.linkClicks >= 20 && window.conversion === 0) {
    return 'low';
  }

  return window.linkClicks > 0 ? 'medium' : 'low';
}
