export type MotionVector3 = { x: number; y: number; z: number };

export type PhoneMotionSummary = {
  source: 'phone-motion-sensors';
  capturedAt: string;
  durationMs: number;
  accelerometerSampleCount: number;
  gyroscopeSampleCount: number;
  peakDynamicAccelerationG: number;
  peakRotationDegPerSecond: number;
};

const isValidVector = (sample: MotionVector3) =>
  Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.z);

function round(value: number) {
  return Math.round(value * 100) / 100;
}

export function summarizePhoneMotion(
  acceleration: readonly MotionVector3[],
  rotation: readonly MotionVector3[],
  startedAtMs: number,
  endedAtMs: number,
): PhoneMotionSummary {
  const durationMs = endedAtMs - startedAtMs;
  const validAcceleration = acceleration.filter(isValidVector);
  const validRotation = rotation.filter(isValidVector);

  if (!Number.isFinite(startedAtMs) || !Number.isFinite(endedAtMs) || durationMs < 500 || durationMs > 30_000) {
    throw new Error('Motion capture must last from 0.5 to 30 seconds.');
  }
  if (validAcceleration.length < 5 || validRotation.length < 5) {
    throw new Error('Not enough accelerometer and gyroscope samples were received. Try again.');
  }

  const peakDynamicAccelerationG = Math.max(...validAcceleration.map((sample) =>
    Math.abs(Math.hypot(sample.x, sample.y, sample.z) - 1),
  ));
  const peakRotationDegPerSecond = Math.max(...validRotation.map((sample) =>
    Math.hypot(sample.x, sample.y, sample.z) * 180 / Math.PI,
  ));

  return {
    source: 'phone-motion-sensors',
    capturedAt: new Date(startedAtMs).toISOString(),
    durationMs,
    accelerometerSampleCount: validAcceleration.length,
    gyroscopeSampleCount: validRotation.length,
    peakDynamicAccelerationG: round(peakDynamicAccelerationG),
    peakRotationDegPerSecond: round(peakRotationDegPerSecond),
  };
}
