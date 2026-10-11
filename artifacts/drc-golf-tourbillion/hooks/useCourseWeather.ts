import { useQuery } from '@tanstack/react-query';
import type { WindReading } from '@/utils/wind';

export type CourseWeather = WindReading & { temperature: number; code: number };
export async function fetchCourseWeather(latitude: number, longitude: number, signal: AbortSignal): Promise<CourseWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error('Weather unavailable.');
  const result = await response.json();
  const current = result.current;
  const weather = {
    temperature: current?.temperature_2m, windKph: current?.wind_speed_10m,
    windDirection: current?.wind_direction_10m, code: current?.weather_code,
  };
  if (![weather.temperature, weather.windKph, weather.windDirection, weather.code].every(Number.isFinite)
    || weather.windKph < 0 || weather.windDirection < 0 || weather.windDirection > 360) throw new Error('Weather data is incomplete.');
  return weather;
}

/** Shared course-keyed cache: opening a weather panel is not needed for wind. */
export function useCourseWeather(latitude?: number, longitude?: number) {
  return useQuery({
    queryKey: ['course-weather', latitude, longitude],
    enabled: Number.isFinite(latitude) && Number.isFinite(longitude),
    queryFn: ({ signal }) => fetchCourseWeather(latitude!, longitude!, signal),
    staleTime: 60_000, refetchInterval: 300_000, retry: 0,
  });
}
