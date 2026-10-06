export function getHoleMapLayout(windowWidth: number, windowHeight = 800) {
  const width = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 360;
  const height = Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 800;
  const sideBySide = width >= 600 || (width >= 520 && width / height >= 1.18);
  const viewWidth = 260;
  const mapPanelWidth = Math.max(1, sideBySide ? (width - 84) / 2 : width - 72);
  const maxFrameHeight = Math.max(1, Math.floor(height * 0.9));
  const minimumFrameHeight = Math.min(sideBySide ? 280 : 220, maxFrameHeight);
  const preferredFrameHeight = sideBySide ? mapPanelWidth * 2.1 : Math.min(340, height * 0.4);
  const frameHeight = Math.max(
    1,
    Math.min(
      900,
      maxFrameHeight,
      Math.max(minimumFrameHeight, Math.round(preferredFrameHeight)),
    ),
  );
  const viewHeight = Math.max(1, Math.round(frameHeight * viewWidth / mapPanelWidth));
  const verticalInset = Math.min(38, viewHeight * 0.12);
  const tall = frameHeight > mapPanelWidth;
  return {
    sideBySide,
    tall,
    viewWidth,
    viewHeight,
    frameHeight,
    mapPanelWidth,
    plot: {
      left: 28,
      top: verticalInset,
      width: viewWidth - 56,
      height: Math.max(1, viewHeight - verticalInset * 2),
    },
  };
}