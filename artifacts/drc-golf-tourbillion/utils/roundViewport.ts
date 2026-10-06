/** Space left for the hole after the primary controls, safe areas and tab bar. */
export function getRoundMapHeight(
  height: number,
  fontScale = 1,
  topInset = 0,
  bottomInset = 0,
  web = false,
  landscape = false,
) {
  const screenHeight = Number.isFinite(height) && height > 0 ? height : 780;
  const scale = Math.min(1.3, Math.max(1, fontScale || 1));
  const top = web
    ? (screenHeight < 700 ? 16 : Math.min(67, screenHeight * 0.07))
    : Math.max(topInset, 12) + (screenHeight < 700 ? 4 : 8);
  const tabs = web ? 84 : 62 + bottomInset;
  const controlsAndHeading = (landscape ? 145 : 345) * scale;
  return Math.max(48, Math.min(360, Math.floor(screenHeight - top - tabs - controlsAndHeading - 24)));
}
