import type { GolfCourse } from '../context/GolfContext';
import { canonicalCourseId } from './courseGeometry';
import { CAPRICORN_CHAMPIONSHIP_ID, capricornChampionshipCourse } from './capricornChampionship';

// Public directory metadata lets a discovered course be viewed without saving
// it, changing the selected course or finishing an existing round.
export function courseMapHref(course: GolfCourse) {
  return {
    pathname: '/course-map' as const,
    params: {
      courseId: course.id, courseName: course.name,
      latitude: String(course.latitude), longitude: String(course.longitude), par: String(course.par),
    },
  };
}

export function resolveMapCourse(
  params: Record<string, string | string[] | undefined>,
  courses: GolfCourse[],
): GolfCourse | undefined {
  const id = typeof params.courseId === 'string' ? canonicalCourseId(params.courseId) : '';
  const saved = courses.find(course => canonicalCourseId(course.id) === id);
  if (saved) return saved;
  if (id === CAPRICORN_CHAMPIONSHIP_ID) return capricornChampionshipCourse;
  const { courseName, latitude, longitude, par } = params;
  if (!/^osm-(way|relation)-[1-9]\d{0,14}$/.test(id)
    || typeof courseName !== 'string' || !courseName.trim() || courseName.length > 200
    || typeof latitude !== 'string' || !latitude.trim()
    || typeof longitude !== 'string' || !longitude.trim() || typeof par !== 'string') return undefined;
  const lat = Number(latitude), lon = Number(longitude), totalPar = Number(par);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180
    || !Number.isInteger(totalPar) || totalPar < 1 || totalPar > 180) return undefined;
  return { id, name: courseName.trim(), latitude: lat, longitude: lon, par: totalPar,
    area: 'OpenStreetMap course', source: 'OpenStreetMap directory' };
}
