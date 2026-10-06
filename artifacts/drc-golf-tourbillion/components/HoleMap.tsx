import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import { AppText as Text } from '@/components/AppText';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { Coordinate, VerifiedHole } from '@/utils/courseGeometry';
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

export function HoleMap({ geometry, position, dailyPin, wind, availableHeight }: {
  geometry?: VerifiedHole;
  position?: Coordinate | null;
  dailyPin?: Coordinate;
  wind?: WindReading | null;
  availableHeight?: number;
}) {
  const colors = useColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { viewWidth, viewHeight, frameHeight, plot } = getHoleMapLayout(windowWidth, windowHeight, availableHeight);
  const shortMap = viewHeight < 120;
  const labelSize = shortMap ? 10 : 12;
  const labelX = (x: number) => Math.max(36, Math.min(viewWidth - 36, x));
  const labelY = (y: number) => Math.max(labelSize + 2, Math.min(viewHeight - 4, y));
  const flowDirection = wind ? windFlowDirectionDegrees(wind.windDirection) : null;
  const movingWind = wind && flowDirection !== null && Number.isFinite(wind.windKph) && wind.windKph >= 1;
  if (!geometry) {
    return (
      <View style={{ minHeight: 100, justifyContent: 'center', padding: 16, backgroundColor: colors.mapBase, borderRadius: 16 }}>
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>Verified hole map unavailable</Text>
        <Text style={{ color: colors.mutedForeground, fontSize: 14, lineHeight: 21, marginTop: 8 }}>Scoring and course weather remain available. No estimated target is used.</Text>
      </View>
    );
  }
  // Local equirectangular projection; equal scale on both axes, north up.
  const origin = geometry.path[0];
  const local = (point: Coordinate) => ({
    x: (point.longitude - origin.longitude) * Math.cos(origin.latitude * Math.PI / 180) * 111320,
    y: -(point.latitude - origin.latitude) * 111320,
  });
  const points = geometry.path.map(local);
  if (position) points.push(local(position));
  if (dailyPin) points.push(local(dailyPin));
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const scale = Math.min(plot.width / Math.max(1, maxX - minX), plot.height / Math.max(1, maxY - minY));
  const project = (point: Coordinate) => {
    const p = local(point);
    return {
      x: plot.left + (plot.width - (maxX - minX) * scale) / 2 + (p.x - minX) * scale,
      y: plot.top + (plot.height - (maxY - minY) * scale) / 2 + (p.y - minY) * scale,
    };
  };
  const path = geometry.path.map(project);
  const target = project(geometry.target);
  const player = position ? project(position) : null;
  const pin = dailyPin ? project(dailyPin) : null;
  return (
    <View accessibilityLabel={`Hole ${geometry.hole}, sourced tee-to-green playing path, north up${wind ? `, wind from ${compassDirectionLabel(wind.windDirection)} at ${Math.round(wind.windKph)} kilometres per hour` : ''}`} style={{ width: '100%', height: frameHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.mapBase }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`}>
        <Path d={path.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} stroke={colors.mapGreen} strokeWidth={3} fill="none" />
        <Circle cx={path[0].x} cy={path[0].y} r={5} fill={colors.mutedForeground} />
        <SvgText x={labelX(path[0].x)} y={labelY(path[0].y + 20)} fontSize={labelSize} textAnchor="middle" fill={colors.foreground}>Tee</SvgText>
        <Circle cx={target.x} cy={target.y} r={6} fill={colors.primary} />
        <SvgText x={labelX(target.x)} y={labelY(target.y - 12)} fontSize={labelSize} textAnchor="middle" fill={colors.foreground}>Green ref</SvgText>
        {pin ? <>
          <Circle cx={pin.x} cy={pin.y} r={9} fill="none" stroke={colors.foreground} strokeWidth={2} />
          <SvgText x={labelX(pin.x)} y={labelY(pin.y + 24)} fontSize={labelSize} textAnchor="middle" fill={colors.foreground}>Your pin</SvgText>
        </> : null}
        {player ? <Circle cx={player.x} cy={player.y} r={6} fill={colors.foreground} stroke={colors.background} strokeWidth={2} /> : null}
        <SvgText x={viewWidth - 12} y={shortMap ? viewHeight - 6 : 20} fontSize={labelSize} textAnchor="end" fill={colors.foreground}>N ↑</SvgText>
        {!shortMap ? <SvgText x={12} y={viewHeight - 10} fontSize={12} fill={colors.mutedForeground}>{player ? 'White marker: your GPS position' : 'Playing path · not a fairway outline'}</SvgText> : null}
      </Svg>
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
  windArrow: { position: 'absolute', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  windBadge: { position: 'absolute', top: 9, left: 9, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  windText: { fontSize: 12, lineHeight: 16, fontFamily: 'Inter_700Bold', letterSpacing: 0.15 },
});