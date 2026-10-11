import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Linking, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { Coordinate, distanceMeters, MapFeature, VerifiedHole } from '@/utils/courseGeometry';
import { getHoleMapLayout } from '@/utils/holeMapLayout';
import { compassDirectionLabel, windAnimationDuration, windFlowDirectionDegrees, WindReading } from '@/utils/wind';

type WindArrowAnchor = { left: `${number}%`; top: `${number}%` };

const windArrowAnchors: WindArrowAnchor[] = [
  { left: '18%', top: '23%' }, { left: '51%', top: '19%' }, { left: '78%', top: '28%' },
  { left: '27%', top: '44%' }, { left: '63%', top: '48%' },
  { left: '17%', top: '67%' }, { left: '48%', top: '73%' }, { left: '78%', top: '70%' },
];

function WindArrow({ anchor, index, direction, duration, color }: {
  anchor: WindArrowAnchor;
  index: number;
  direction: number;
  duration: number;
  color: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const radians = direction * Math.PI / 180;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(radians) * 46] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.cos(radians) * 46] });
  const opacity = progress.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0.3, 0.95, 0.95, 0.3] });
  const nativeDriver = Platform.OS !== 'web';

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: nativeDriver,
    }));
    const animation = Animated.sequence([Animated.delay(index * 180), loop]);
    animation.start();
    return () => {
      animation.stop();
      progress.setValue(0);
    };
  }, [duration, index, nativeDriver, progress]);

  return (
    <Animated.View style={[
      styles.windArrow,
      anchor,
      { opacity, pointerEvents: 'none', transform: [{ translateX }, { translateY }] },
    ]}>
      <View style={{ transform: [{ rotate: `${direction}deg` }] }}>
        <Feather name="arrow-up" size={15} color={color} />
      </View>
    </Animated.View>
  );
}

const NEAR_M = 200;
const FEATURE_STYLE: Record<MapFeature['kind'], { fill: string; opacity: number; stroke?: string }> = {
  rough: { fill: 'mapRough', opacity: 0.35 },
  trees: { fill: 'mapContour', opacity: 0.9 },
  water: { fill: 'mapContour', opacity: 1, stroke: 'mapOuterGreen' },
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { viewWidth, viewHeight, frameHeight, plot } = getHoleMapLayout(windowWidth, windowHeight, availableHeight);
  const shortMap = viewHeight < 120;
  const labelSize = shortMap ? 10 : 12;
  const flowDirection = wind ? windFlowDirectionDegrees(wind.windDirection) : null;
  const movingWind = wind && flowDirection !== null && Number.isFinite(wind.windKph) && wind.windKph >= 1;
  if (!geometry || !geometry.path || geometry.path.length < 2) {
    return (
      <View style={{ minHeight: 100, justifyContent: 'center', padding: 16, backgroundColor: colors.mapBase, borderRadius: 16 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Hole layout not loaded or not mapped</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 8 }}>
          Load the free course map below. If this hole has no numbered playing path in the data, no layout or target is invented. Scoring, GPS and weather still work.
        </Text>
      </View>
    );
  }
  // Local equirectangular projection; equal scale on both axes, north up.
  const origin = geometry.path[0];
  const cosLat = Math.cos(origin.latitude * Math.PI / 180);
  const local = (point: Coordinate) => ({
    x: (point.longitude - origin.longitude) * cosLat * 111320,
    y: -(point.latitude - origin.latitude) * 111320,
  });
  const pts = geometry.path.map(local);
  const pMinX = Math.min(...pts.map((p) => p.x));
  const pMaxX = Math.max(...pts.map((p) => p.x));
  const pMinY = Math.min(...pts.map((p) => p.y));
  const pMaxY = Math.max(...pts.map((p) => p.y));
  const isNear = (c: Coordinate) => {
    const p = local(c);
    return Number.isFinite(p.x) && Number.isFinite(p.y)
      && p.x >= pMinX - NEAR_M && p.x <= pMaxX + NEAR_M && p.y >= pMinY - NEAR_M && p.y <= pMaxY + NEAR_M;
  };
  const playerNear = position ? isNear(position) : true;
  const pinNear = dailyPin ? isNear(dailyPin) : true;
  const fitPts = [...pts];
  if (position && playerNear) fitPts.push(local(position));
  if (dailyPin && pinNear) fitPts.push(local(dailyPin));
  let minX = Math.min(...fitPts.map((p) => p.x));
  let maxX = Math.max(...fitPts.map((p) => p.x));
  let minY = Math.min(...fitPts.map((p) => p.y));
  let maxY = Math.max(...fitPts.map((p) => p.y));
  // Real-world margin so the fairway and green around the path stay visible.
  const margin = Math.max(30, 0.15 * Math.max(maxX - minX, maxY - minY));
  minX -= margin; maxX += margin; minY -= margin; maxY += margin;
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const scale = Math.min(plot.width / spanX, plot.height / spanY);
  const offX = plot.left + (plot.width - spanX * scale) / 2;
  const offY = plot.top + (plot.height - spanY * scale) / 2;
  const project = (point: Coordinate) => {
    const p = local(point);
    return { x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale };
  };
  const path = geometry.path.map(project);
  const target = project(geometry.target);
  const player = position && playerNear ? project(position) : null;
  const pin = dailyPin && pinNear ? project(dailyPin) : null;

  // Only real polygons that touch the viewport are drawn; the clip path trims the rest.
  const visible = (features ?? []).filter((f) => f.rings?.length).map((f) => {
    const rings = f.rings.filter((r) => r.length >= 3).map((r) => r.map(project)).filter((r) => r.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    const all = rings.flat();
    let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
    for (const p of all) { loX = Math.min(loX, p.x); hiX = Math.max(hiX, p.x); loY = Math.min(loY, p.y); hiY = Math.max(hiY, p.y); }
    const hit = all.length > 0 && hiX >= 0 && loX <= viewWidth && hiY >= 0 && loY <= viewHeight;
    return { f, rings, hit };
  }).filter((v) => v.hit && v.rings.length);
  const hasSurfaces = visible.length > 0;
  const clipId = `holeclip-${geometry.hole}`;
  const col = colors as unknown as Record<string, string>;

  // Labels sit beyond the marker, away from the path, and are dropped when they would collide.
  const tee = path[0];
  const teeAbove = tee.y > target.y;
  const clampX = (x: number) => Math.max(30, Math.min(viewWidth - 30, x));
  const teeLabel = { x: clampX(tee.x), y: tee.y + (teeAbove ? labelSize + 11 : -11) };
  const tgtLabel = { x: clampX(target.x), y: target.y + (teeAbove ? -12 : labelSize + 12) };
  const inView = (y: number) => y >= labelSize && y <= viewHeight - 2;
  const labelsClear = Math.hypot(tee.x - target.x, tee.y - target.y) > 34 || Math.abs(teeLabel.y - tgtLabel.y) > labelSize + 4;
  const showTeeLabel = inView(teeLabel.y) && labelsClear && !(shortMap && Math.abs(tee.y - target.y) < 28);
  const showTgtLabel = inView(tgtLabel.y) && labelsClear && !(shortMap && Math.abs(tee.y - target.y) < 28);
  const distanceNote = (c: Coordinate) => `${Math.round(distanceMeters(c, geometry.target))} m`;
  const note = position && !playerNear
    ? `GPS fix is ${distanceNote(position)} from the mapped target, outside the view.`
    : dailyPin && !pinNear
      ? `Saved pin is ${distanceNote(dailyPin)} from the mapped target, outside the view.`
      : hasSurfaces ? 'Mapped surfaces from OpenStreetMap; may be incomplete.' : 'Playing path only. No fairway or green outlines mapped.';
  const dFor = (rings: { x: number; y: number }[][]) => rings.map((r) => `${r.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')}Z`).join(' ');
  return (
    <View accessibilityLabel={`Hole ${geometry.hole}, ${hasSurfaces ? 'mapped surfaces and' : 'path-only,'} tee-to-green playing path, north up. ${note}${wind ? ` Wind from ${compassDirectionLabel(wind.windDirection)} at ${Math.round(wind.windKph)} kilometres per hour` : ''}`} style={{ width: '100%', height: frameHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.mapBase }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
        <Defs><ClipPath id={clipId}><Rect x={0} y={0} width={viewWidth} height={viewHeight} /></ClipPath></Defs>
        <G clipPath={`url(#${clipId})`}>
          {DRAW_ORDER.flatMap((kind) => visible.filter((v) => v.f.kind === kind).map((v) => {
            const st = FEATURE_STYLE[kind];
            return <Path key={`${kind}-${v.f.id}`} d={dFor(v.rings)} fillRule="evenodd" fill={col[st.fill]} fillOpacity={st.opacity} stroke={st.stroke ? col[st.stroke] : 'none'} strokeWidth={st.stroke ? 1 : 0} />;
          }))}
          <Path d={path.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} stroke={colors.mapGreen} strokeWidth={hasSurfaces ? 1.5 : 3} strokeDasharray={hasSurfaces ? '4 3' : undefined} fill="none" />
        </G>
        <Circle cx={tee.x} cy={tee.y} r={shortMap ? 3 : 5} fill={colors.mutedForeground} />
        {showTeeLabel ? <SvgText x={teeLabel.x} y={teeLabel.y} fontSize={labelSize} textAnchor="middle" fill={colors.foreground}>Tee</SvgText> : null}
        <Circle cx={target.x} cy={target.y} r={shortMap ? 3 : 6} fill={colors.primary} />
        {showTgtLabel ? <SvgText x={tgtLabel.x} y={tgtLabel.y} fontSize={labelSize} textAnchor="middle" fill={colors.foreground}>{geometry.targetKind === 'path-end' ? 'Hole end' : 'Green ref'}</SvgText> : null}
        {pin ? <Circle cx={pin.x} cy={pin.y} r={shortMap ? 5 : 9} fill="none" stroke={colors.foreground} strokeWidth={2} /> : null}
        {player ? <Circle cx={player.x} cy={player.y} r={shortMap ? 3 : 6} fill={colors.foreground} stroke={colors.background} strokeWidth={2} /> : null}
        <SvgText x={viewWidth - 12} y={labelSize + 6} fontSize={labelSize} textAnchor="end" fill={colors.foreground}>N ↑</SvgText>
      </Svg>
      {!shortMap ? (
        <Text numberOfLines={2} style={[styles.note, { color: colors.mutedForeground, pointerEvents: 'none' }]}>{note}{pin ? ' Ring: your pin.' : ''}{player ? ' White dot: you.' : ''}</Text>
      ) : null}
      <Pressable accessibilityRole="link" accessibilityLabel="OpenStreetMap copyright" hitSlop={8} onPress={() => { Linking.openURL('https://www.openstreetmap.org/copyright').catch(() => undefined); }} style={[styles.attribution, { backgroundColor: colors.mapBase }]}>
        <Text style={[styles.attributionText, { color: colors.mutedForeground }]}>© OpenStreetMap</Text>
      </Pressable>
      {wind ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.windBadge, { backgroundColor: colors.mapBase, borderColor: colors.border, pointerEvents: 'none' }]}>
          <Feather name="wind" size={11} color={colors.primary} />
          <Text style={[styles.windText, { color: colors.foreground }]}>{wind.windKph < 1 ? 'CALM' : `FROM ${compassDirectionLabel(wind.windDirection)} · ${Math.round(wind.windKph)} km/h`}</Text>
        </View>
      ) : null}
      {movingWind ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
          {windArrowAnchors.map((anchor, index) => (
            <WindArrow key={index} anchor={anchor} index={index} direction={flowDirection} duration={windAnimationDuration(wind.windKph)} color={colors.primary} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: { position: 'absolute', left: 9, bottom: 7, maxWidth: '64%', fontSize: 10, lineHeight: 13 },
  attribution: { position: 'absolute', right: 6, bottom: 5, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, opacity: 0.92 },
  attributionText: { fontSize: 10, lineHeight: 13, textDecorationLine: 'underline' },
  windArrow: { position: 'absolute', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  windBadge: { position: 'absolute', top: 9, left: 9, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  windText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.15 },
});