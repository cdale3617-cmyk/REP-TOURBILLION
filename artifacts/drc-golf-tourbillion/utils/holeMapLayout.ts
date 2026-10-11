type MapPoint = { x: number; y: number };

// A display-only crop around the selected playing path. It is not a surveyed
// fairway outline, a green reference or an assignment of polygons to a hole.
export function getHoleFocusClip(points: MapPoint[], pixelsPerMetre: number) {
  if (!Number.isFinite(pixelsPerMetre) || pixelsPerMetre <= 0
    || points.length < 2 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error('A hole focus crop requires a valid projected playing path and scale.');
  }
  const radius = 45 * pixelsPerMetre;
  const segments: MapPoint[][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    const nx = -dy / length * radius, ny = dx / length * radius;
    segments.push([
      { x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny },
      { x: b.x - nx, y: b.y - ny }, { x: a.x - nx, y: a.y - ny },
    ]);
  }
  return { radius, segments, centres: points };
}

export function getHoleMapLayout(windowWidth: number, windowHeight = 800, availableHeight?: number) {
  const width = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 360;
  const height = Number.isFinite(windowHeight) && windowHeight > 0 ? windowHeight : 800;
  const sideBySide = width >= 600 || (width >= 520 && width / height >= 1.18);
  const viewWidth = 260;
  const mapPanelWidth = Math.max(1, sideBySide ? (width - 84) / 2 : width - 72);
  const maxFrameHeight = Math.max(1, Math.floor(Math.min(height * 0.9,
    availableHeight !== undefined && Number.isFinite(availableHeight) ? availableHeight : Infinity)));
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
  // Reserve space for tee/green labels even in a short landscape canvas.
  const verticalInset = Math.min(38, Math.max(24, viewHeight * 0.12), viewHeight * 0.38);
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