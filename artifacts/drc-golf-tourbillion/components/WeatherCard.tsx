import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { Card } from '@/components/Primitives';
import { compassDirectionLabel, WindReading } from '@/utils/wind';

type Weather = WindReading & { temperature: number; code: number };
function condition(code: number) {
  if (code === 0) return 'Clear skies';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Fog';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm';
  return 'Conditions unavailable';
}

export function WeatherCard({ latitude, longitude, onWindChange }: {
  latitude: number;
  longitude: number;
  onWindChange?: (reading: WindReading | null) => void;
}) {
  const colors = useColors();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Weather request failed.');
      const result = await response.json();
      const current = result.current as { temperature_2m: number; wind_speed_10m: number; wind_direction_10m: number; weather_code: number };
      const reading: Weather = {
        temperature: current.temperature_2m,
        windKph: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        code: current.weather_code,
      };
      if (![reading.temperature, reading.windKph, reading.windDirection, reading.code].every(Number.isFinite)) {
        throw new Error('Weather data is incomplete.');
      }
      setWeather(reading);
      onWindChange?.({ windKph: reading.windKph, windDirection: reading.windDirection });
    } catch {
      setWeather(null);
      onWindChange?.(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, onWindChange]);

  useEffect(() => { void load(); }, [load]);
  return (
    <Card style={styles.card}>
      <View style={styles.top}>
      <View style={[styles.icon, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Feather name="wind" size={17} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { color: colors.foreground }]}>COURSE WEATHER</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>Open-Meteo · course-area forecast</Text>
        </View>
        <Pressable onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Refresh weather" testID="weather-refresh">
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />}
        </Pressable>
      </View>
      {weather ? (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.temp, { color: colors.foreground }]}>{Math.round(weather.temperature)}°</Text>
            <Text style={[styles.condition, { color: colors.mutedForeground }]}>{condition(weather.code)}</Text>
          </View>
          <View style={[styles.wind, { borderColor: colors.border }]}>
            <Feather name="navigation" size={13} color={colors.primary} />
            <Text style={[styles.windText, { color: colors.foreground }]}>{Math.round(weather.windKph)} km/h {compassDirectionLabel(weather.windDirection)}</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.sub, { color: error ? colors.destructive : colors.mutedForeground }]}>
          {loading ? 'Loading live forecast…' : error ? 'Weather unavailable. Tap refresh to try again.' : 'No forecast data.'}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 15, gap: 14 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  heading: { fontSize: 13, lineHeight: 18, fontFamily: 'Inter_700Bold', letterSpacing: 1 },
  sub: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular', marginTop: 3, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  temp: { fontSize: 34, fontFamily: 'serif' },
  condition: { fontSize: 14, lineHeight: 20, fontFamily: 'Inter_400Regular' },
  wind: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9 },
  windText: { fontSize: 14, lineHeight: 19, fontFamily: 'Inter_600SemiBold' },
});