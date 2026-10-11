import type { Coordinate } from './courseGeometry';

/** Even/odd polygon membership, including a sourced outline's exact edge. */
export function pointInMappedPolygon(point: Coordinate, rings: Coordinate[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j], b = ring[i];
      const dx = b.longitude - a.longitude, dy = b.latitude - a.latitude;
      const px = point.longitude - a.longitude, py = point.latitude - a.latitude;
      if (Math.abs(dx * py - dy * px) <= 1e-14
        && point.longitude >= Math.min(a.longitude, b.longitude) - 1e-10
        && point.longitude <= Math.max(a.longitude, b.longitude) + 1e-10
        && point.latitude >= Math.min(a.latitude, b.latitude) - 1e-10
        && point.latitude <= Math.max(a.latitude, b.latitude) + 1e-10) return true;
      if ((a.latitude > point.latitude) !== (b.latitude > point.latitude)
        && point.longitude < dx * py / dy + a.longitude) inside = !inside;
    }
  }
  return inside;
}
