export type WindReading = {
  windKph: number;
  windDirection: number;
};

const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function normalizeWindDirection(degrees: number): number | null {
  if (!Number.isFinite(degrees)) return null;
  return ((degrees % 360) + 360) % 360;
}

export function compassDirectionLabel(degrees: number): string {
  const normalized = normalizeWindDirection(degrees);
  if (normalized === null) return '—';
  return compassPoints[Math.round(normalized / 45) % compassPoints.length];
}

/** Open-Meteo reports the direction wind comes from; arrows point where it blows. */
export function windFlowDirectionDegrees(windFromDegrees: number): number | null {
  const normalized = normalizeWindDirection(windFromDegrees);
  return normalized === null ? null : (normalized + 180) % 360;
}

export function windAnimationDuration(windKph: number): number {
  const speed = Number.isFinite(windKph) ? Math.max(0, windKph) : 0;
  return Math.max(1100, Math.min(5000, Math.round(5000 - speed * 130)));
}
