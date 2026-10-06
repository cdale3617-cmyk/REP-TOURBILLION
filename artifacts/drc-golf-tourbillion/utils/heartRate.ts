// Bluetooth SIG Heart Rate Measurement (0x2A37): flags + 8/16-bit bpm.
// No dependency on browser atob or Node Buffer in a native bundle.
export function decodeHeartRate(encoded: string): number {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let bits = 0, value = 0;
  for (const char of encoded.replace(/=+$/, '')) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error('Invalid sensor packet.');
    value = (value << 6) | digit;
    bits += 6;
    if (bits >= 8) { bits -= 8; bytes.push((value >> bits) & 255); }
  }
  if (bytes.length < 2 || ((bytes[0] & 1) && bytes.length < 3)) {
    throw new Error('Incomplete heart-rate packet.');
  }
  if ((bytes[0] & 4) && !(bytes[0] & 2)) {
    throw new Error('Monitor reports no skin contact. Adjust the sensor.');
  }
  const bpm = bytes[0] & 1 ? bytes[1] | (bytes[2] << 8) : bytes[1];
  if (!bpm) throw new Error('Monitor has not measured a heart rate yet.');
  return bpm;
}