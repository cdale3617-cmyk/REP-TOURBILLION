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
  const preferredFrameHeight = sideBySide ? mapPanelWidth * 2.1 : Math.min(620, height * 0.62);
  const frameHeight = Math.max(
    1,
    Math.min(
      900,
      maxFrameHeight,
      Math.max(minimumFrameHeight, Math.round(preferredFrameHeight)),
    ),
  );
  const viewHeight = Math.max(1, Math.round(frameHeight * viewWidth / mapPanelWidth));
  // Text lives outside the drawing, so only a small inset is needed.
  const verticalInset = Math.min(18, viewHeight * 0.1);
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
type Geo = { latitude: number; longitude: number };

/** Initial compass bearing from a to b, degrees clockwise from north. */
export function bearingDegrees(a: Geo, b: Geo) {
  const cosLat = Math.cos(a.latitude * Math.PI / 180);
  const east = (b.longitude - a.longitude) * cosLat, north = b.latitude - a.latitude;
  if (east === 0 && north === 0) return 0;
  return (Math.atan2(east, north) * 180 / Math.PI + 360) % 360;
}

/** Screen angle (clockwise from up) of a compass direction on a map whose up is `heading`. */
export function screenAngle(compassDegrees: number, heading: number) {
  return (((compassDegrees - heading) % 360) + 360) % 360;
}

/**
 * Tee-to-target projection: real coordinates are rotated so the target is up,
 * with one equal metre scale on both axes. Nothing is invented or stretched.
 */
export function createHoleProjection(
  path: Geo[], target: Geo, extra: Geo[],
  plot: { left: number; top: number; width: number; height: number },
) {
  const origin = path[0];
  const cosLat = Math.cos(origin.latitude * Math.PI / 180);
  const heading = bearingDegrees(origin, target);
  const t = heading * Math.PI / 180;
  const local = (c: Geo) => {
    const e = (c.longitude - origin.longitude) * cosLat * 111320;
    const n = (c.latitude - origin.latitude) * 111320;
    return { x: e * Math.cos(t) - n * Math.sin(t), y: -(e * Math.sin(t) + n * Math.cos(t)) };
  };
  const pts = [...path, target, ...extra].map(local);
  let minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
  let minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
  const margin = Math.max(30, 0.12 * Math.max(maxX - minX, maxY - minY));
  minX -= margin; maxX += margin; minY -= margin; maxY += margin;
  const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
  const scale = Math.min(plot.width / spanX, plot.height / spanY);
  const offX = plot.left + (plot.width - spanX * scale) / 2;
  const offY = plot.top + (plot.height - spanY * scale) / 2;
  const project = (c: Geo) => {
    const p = local(c);
    return { x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale };
  };
  return { project, heading, scale, northAngle: screenAngle(0, heading) };
}
