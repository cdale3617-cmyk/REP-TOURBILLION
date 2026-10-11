import React, { useId } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, ClipPath, Defs, G, Line, Path, Polygon, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { Coordinate, distanceMeters, MapFeature, VerifiedHole } from '@/utils/courseGeometry';
import { createHoleProjection, getHoleFocusClip, getHoleMapLayout, screenAngle } from '@/utils/holeMapLayout';
import { getHoleFeatureTargets, getHoleStrategies } from '@/utils/holeStrategies';
import { pointInMappedPolygon } from '@/utils/mappedPolygons';
import { compassDirectionLabel, windFlowDirectionDegrees, WindReading } from '@/utils/wind';

const NEAR_M = 200;
const FEATURE_STYLE: Record<MapFeature['kind'], { fill: string; opacity: number; stroke?: string }> = {
  rough: { fill: 'mapRough', opacity: 0.35 },
  trees: { fill: 'mapContour', opacity: 0.9 },
  water: { fill: 'mapContour', opacity: 1, stroke: 'mapRough' },
  fairway: { fill: 'mapFairway', opacity: 0.75 },
  tee: { fill: 'mapOuterGreen', opacity: 0.8 },
  bunker: { fill: 'foreground', opacity: 0.5 },
  green: { fill: 'mapGreen', opacity: 0.85 },
};
const DRAW_ORDER: MapFeature['kind'][] = ['rough', 'trees', 'water', 'fairway', 'tee', 'bunker', 'green'];

export function HoleMap({ geometry, position, dailyPin, wind, availableHeight, features }: {
  geometry?: VerifiedHole;
  position?: Coordinate | null;
  dailyPin?: Coordinate;
  wind?: WindReading | null;
  availableHeight?: number;
  features?: MapFeature[];
}) {
  const colors = useColors();
  const instanceId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { viewWidth, viewHeight, frameHeight, plot } = getHoleMapLayout(windowWidth, windowHeight, availableHeight);
  const shortMap = viewHeight < 120;
  const flowDirection = wind ? windFlowDirectionDegrees(wind.windDirection) : null;
  const movingWind = wind && flowDirection !== null && Number.isFinite(wind.windKph) && wind.windKph >= 1;
  if (!geometry || !geometry.path || geometry.path.length < 2) {
    return (
      <View testID="hole-map-missing-data" style={{ minHeight: 100, justifyContent: 'center', padding: 16, backgroundColor: colors.mapBase, borderRadius: 16 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Hole layout not loaded or not mapped</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 8 }}>
          Load the free course map below. If this hole has no numbered playing path in the data, no layout or target is invented. Scoring, GPS and weather still work.
        </Text>
      </View>
    );
  }
  const local0 = geometry.path[0];
  const cosLat = Math.cos(local0.latitude * Math.PI / 180);
  const flat = (point: Coordinate) => ({
    x: (point.longitude - local0.longitude) * cosLat * 111320,
    y: -(point.latitude - local0.latitude) * 111320,
  });
  const pts = geometry.path.map(flat);
  const pMinX = Math.min(...pts.map((p) => p.x));
  const pMaxX = Math.max(...pts.map((p) => p.x));
  const pMinY = Math.min(...pts.map((p) => p.y));
  const pMaxY = Math.max(...pts.map((p) => p.y));
  const isNear = (c: Coordinate) => {
    const p = flat(c);
    return Number.isFinite(p.x) && Number.isFinite(p.y)
      && p.x >= pMinX - NEAR_M && p.x <= pMaxX + NEAR_M && p.y >= pMinY - NEAR_M && p.y <= pMaxY + NEAR_M;
  };
  const playerNear = position ? isNear(position) : true;
  const pinNear = dailyPin ? isNear(dailyPin) : true;
  const extra: Coordinate[] = [];
  if (position && playerNear) extra.push(position);
  if (dailyPin && pinNear) extra.push(dailyPin);
  const strategies = getHoleStrategies(geometry, features ?? []);
  const targets = getHoleFeatureTargets(geometry, features ?? []);
  extra.push(...(strategies.safe ?? []), ...(strategies.aggressive ?? []));
  const { project, scale, heading, northAngle } = createHoleProjection(geometry.path, geometry.target, extra, plot);
  const path = geometry.path.map(project);
  const focus = getHoleFocusClip(path, scale);
  const target = project(geometry.target);
  const routeD = (r: Coordinate[] | null) => r && r.length > 1 ? r.map(project).map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') : null;
  const safeD = routeD(strategies.safe);
  const aggD = routeD(strategies.aggressive);
  const player = position && playerNear ? project(position) : null;
  const pin = dailyPin && pinNear ? project(dailyPin) : null;

  // Only real polygons that touch the viewport are drawn; the clip path trims the rest.
  const visible = (features ?? []).filter((f) => f.rings?.length
    && (f.kind !== 'green' || pointInMappedPolygon(geometry.target, f.rings))).map((f) => {
    const rings = f.rings.filter((r) => r.length >= 3).map((r) => r.map(project)).filter((r) => r.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const all = rings.flat();
    let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
    for (const p of all) { loX = Math.min(loX, p.x); hiX = Math.max(hiX, p.x); loY = Math.min(loY, p.y); hiY = Math.max(hiY, p.y); }
    const hit = all.length > 0 && hiX >= 0 && loX <= viewWidth && hiY >= 0 && loY <= viewHeight;
    return { f, rings, hit };
  }).filter((v) => v.hit && v.rings.length);
  const hasSurfaces = visible.length > 0;
  const KINDS: { kind: MapFeature['kind']; label: string }[] = [{ kind: 'fairway', label: 'fairway' }, { kind: 'green', label: 'green' }, { kind: 'bunker', label: 'bunkers' }, { kind: 'water', label: 'water' }, { kind: 'trees', label: 'trees' }];
  const missing = KINDS.filter((k) => !visible.some((v) => v.f.kind === k.kind)).map((k) => k.label);
  const pathLength = geometry.path.slice(1).reduce((sum, c, i) => sum + distanceMeters(geometry.path[i], c), 0);
  const windScreen = movingWind && flowDirection !== null ? screenAngle(flowDirection, heading) : null;
  const windArrows: { x: number; y: number }[] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) windArrows.push({ x: viewWidth * (0.22 + c * 0.28) + (r % 2) * 10, y: viewHeight * (0.14 + r * 0.24) });
  const clipId = `holeclip-${instanceId}-${geometry.hole}`;
  const focusClipId = `holefocus-${instanceId}-${geometry.osmWayId}-${geometry.hole}`;
  const col = colors as unknown as Record<string, string>;

  // Keep all text outside the drawing so no label can cover the playing path.
  const tee = path[0];
  const distanceNote = (c: Coordinate) => `${Math.round(distanceMeters(c, geometry.target))} m`;
  const note = position && !playerNear
    ? `GPS fix is ${distanceNote(position)} from the mapped target, outside the view.`
    : dailyPin && !pinNear
      ? `Saved pin is ${distanceNote(dailyPin)} from the mapped target, outside the view.`
      : hasSurfaces ? `Hole ${geometry.hole} view. Outlines are a display crop near this path, not proof of which hole owns them; may be incomplete.` : 'Playing path only. No fairway or green outlines mapped.';
  const dFor = (rings: { x: number; y: number }[][]) => rings.map((r) => `${r.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}Z`).join(' ');
  return (
    <View testID={`hole-map-${geometry.hole}`} accessibilityLabel={`Hole ${geometry.hole}, selected-hole view, ${hasSurfaces ? 'mapped surfaces and' : 'path-only,'} tee-to-${geometry.targetKind === 'path-end' ? 'hole-end' : 'green-reference'} playing path, tee at the bottom, target up. ${note}${wind ? ` Wind from ${compassDirectionLabel(wind.windDirection)} at ${Math.round(wind.windKph)} kilometres per hour` : ''}`} style={{ width: '100%', gap: 7 }}>
      <View testID="hole-map-drawing" style={{ height: frameHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.mapBase }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
        <Defs>
          <ClipPath id={clipId}><Rect x={0} y={0} width={viewWidth} height={viewHeight} /></ClipPath>
          <ClipPath id={focusClipId}>
            {focus.segments.map((segment, i) => <Path key={`segment-${i}`} d={dFor([segment])} />)}
            {focus.centres.map((point, i) => <Circle key={`centre-${i}`} cx={point.x} cy={point.y} r={focus.radius} />)}
          </ClipPath>
        </Defs>
        <G clipPath={`url(#${clipId})`}>
          <G clipPath={`url(#${focusClipId})`}>
          {DRAW_ORDER.flatMap((kind) => visible.filter((v) => v.f.kind === kind).map((v) => {
            const st = FEATURE_STYLE[kind];
            return <Path key={`${kind}-${v.f.id}`} d={dFor(v.rings)} fillRule="evenodd" fill={col[st.fill]} fillOpacity={st.opacity} stroke={st.stroke ? col[st.stroke] : 'none'} strokeWidth={st.stroke ? 1 : 0} />;
          }))}
          </G>
          <Path d={path.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} stroke={colors.mapGreen} strokeWidth={3} fill="none" />
        </G>
        {safeD ? <Path d={safeD} stroke="#E8C84A" strokeWidth={2} strokeDasharray="6 4" fill="none" /> : null}
        {aggD ? <Path d={aggD} stroke="#D9503F" strokeWidth={2} strokeDasharray="6 4" fill="none" /> : null}
        {targets.map((t) => { const q = project(t.coordinate); return <Rect key={`t-${t.id}`} x={q.x - 2.5} y={q.y - 2.5} width={5} height={5} fill={colors.foreground} fillOpacity={0.9} />; })}
        {windScreen !== null ? windArrows.map((w, i) => (
          <G key={`w-${i}`} transform={`translate(${w.x} ${w.y}) rotate(${windScreen})`} opacity={0.55}>
            <Line x1={0} y1={9} x2={0} y2={-9} stroke={colors.primary} strokeWidth={0.9} />
            <Polygon points="0,-11 -3,-5 3,-5" fill={colors.primary} />
          </G>
        )) : null}
        <Circle cx={tee.x} cy={tee.y} r={shortMap ? 3 : 5} fill={colors.mutedForeground} />
        <Circle cx={target.x} cy={target.y} r={shortMap ? 3 : 6} fill={colors.mapGreen} />
        {pin ? <Circle cx={pin.x} cy={pin.y} r={shortMap ? 5 : 9} fill="none" stroke={colors.foreground} strokeWidth={2} /> : null}
        {player ? <Circle cx={player.x} cy={player.y} r={shortMap ? 3 : 6} fill={colors.foreground} stroke={colors.background} strokeWidth={2} /> : null}
      </Svg>
      </View>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
        <Text style={[styles.note, { color: colors.foreground }]}>Tee</Text>
        <View style={[styles.dot, { backgroundColor: colors.mapGreen }]} />
        <Text style={[styles.note, { color: colors.foreground }]}>{geometry.targetKind === 'path-end' ? 'Hole end' : 'Green ref'}{position && playerNear ? ` ${distanceNote(position)}` : ''}</Text>
        {strategies.safe ? <><View style={[styles.dot, { backgroundColor: '#E8C84A' }]} /><Text style={[styles.note, { color: colors.foreground }]}>Safe suggestion</Text></> : null}
        {strategies.aggressive ? <><View style={[styles.dot, { backgroundColor: '#D9503F' }]} /><Text style={[styles.note, { color: colors.foreground }]}>Aggressive suggestion</Text></> : null}
        <Text testID="hole-map-orientation" style={[styles.note, { color: colors.mutedForeground, marginLeft: 'auto' }]}>Hole {geometry.hole} · N arrow {Math.round(northAngle)}° · plays {compassDirectionLabel(heading)}</Text>
        <View accessibilityLabel="North indicator" style={{ transform: [{ rotate: `${northAngle}deg` }] }}><Feather name="arrow-up" size={13} color={colors.foreground} /></View>
      </View>
      <Text testID="hole-map-path-length" style={[styles.note, { color: colors.mutedForeground }]}>Mapped path {Math.round(pathLength)} m (not scorecard yardage).</Text>
      {targets.length ? (
        <Text testID="hole-map-targets" style={[styles.note, { color: colors.mutedForeground }]}>
          Verified targets (small squares): {targets.map((t) => `${t.kind}${position && playerNear ? ` ${Math.round(distanceMeters(position, t.coordinate))} m` : ''}`).join(', ')}.
        </Text>
      ) : null}
      {missing.length ? (
        <View testID="hole-map-missing-data" style={[styles.missing, { borderColor: colors.border, backgroundColor: colors.mapBase }]}>
          <Text style={{ color: colors.foreground, fontSize: 12, lineHeight: 17, fontFamily: 'Inter_600SemiBold' }}>Not mapped for this hole: {missing.join(', ')}</Text>
          <Text style={[styles.note, { color: colors.mutedForeground }]}>No data was found for these in the free map source, so none are drawn or invented.</Text>
        </View>
      ) : null}
      <View testID="hole-map-strategies">
        <Text style={[styles.note, { color: colors.mutedForeground }]}>{strategies.safe || strategies.aggressive ? `Route suggestions, not guarantees. ${strategies.reason}` : `No route suggestion: ${strategies.reason}`}</Text>
      </View>
      <Text testID="hole-map-caption" style={[styles.note, { color: colors.mutedForeground }]}>{note}{pin ? ' Ring: your pin.' : ''}{player ? ' White dot: you.' : ''}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap copyright" hitSlop={8} onPress={() => { Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => undefined); }} style={[styles.attribution, { backgroundColor: colors.mapBase }]}>
        <Text style={[styles.attributionText, { color: colors.mutedForeground }]}>© OpenStreetMap</Text>
      </Pressable>
      {wind ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.windBadge, { backgroundColor: colors.mapBase, borderColor: colors.border, pointerEvents: 'none' }]}>
          <Feather name="wind" size={11} color={colors.primary} />
          <Text style={[styles.windText, { color: colors.foreground }]}>{wind.windKph < 1 ? 'CALM' : `FROM ${compassDirectionLabel(wind.windDirection)} · ${Math.round(wind.windKph)} km/h`}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 11, lineHeight: 15 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  attribution: { alignSelf: 'flex-end', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, opacity: 0.92 },
  attributionText: { fontSize: 10, lineHeight: 13, textDecorationLine: 'underline' },
  missing: { borderWidth: 1, borderRadius: 10, padding: 8, gap: 2 },
  windBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  windText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.15 },
});