import { compassDirectionLabel } from './wind';
import type { WindReading } from './wind';
import type { GolfActivityMetrics } from '@/context/GolfContext';
import type { PhoneMotionSummary } from './phoneMotion';
import type { ShotProfile } from './shotProfiles';
import { inferShotLie, resolveShotConditions, describeShotConditions, type ShotConditions } from './shotConditions';

export type CaddieClub = {
  id?: string;
  name: string;
  make?: string;
  model?: string;
  carryMeters: number;
  loft?: number;
};

export type CaddieAdviceContext = {
  clubs: CaddieClub[];
  unit: 'm' | 'yd';
  currentHole?: number;
  par?: number;
  liveDistanceMeters?: number | null;
  wind?: WindReading | null;
  recentFlight?: CaddieMetricReference;
  recentImpact?: CaddieMetricReference;
  recentPhoneMotion?: PhoneMotionSummary;
  shotProfiles?: ShotProfile[];
  shotConditions?: ShotConditions;
  shotLimits?: { minimumCarryMeters?: number; maximumCarryMeters?: number; troubleSide?: 'left' | 'right' };
};
export type CaddieMetricReference = GolfActivityMetrics & { createdAt: string };


function parseDistanceMeters(question: string, unit: 'm' | 'yd'): number | null {
  const explicit = question.match(/\b(\d+(?:[.,]\d+)?)\s*(m|metres?|meters?|yds?|yards?)\b/i);
  if (explicit) {
    const value = Number(explicit[1].replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    return /^yd|yard/i.test(explicit[2]) ? value / 1.09361 : value;
  }

  const implicit = question.match(/\b(\d{2,3}(?:[.,]\d+)?)\s*(?:out|away|to go|from (?:the )?(?:green|pin|flag))\b/i);
  if (!implicit) return null;
  const value = Number(implicit[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return unit === 'yd' ? value / 1.09361 : value;
}


function formatDistance(meters: number, unit: 'm' | 'yd'): string {
  return `${Math.round(unit === 'yd' ? meters * 1.09361 : meters)} ${unit}`;
}

function formatMetric(value: number | undefined, unit: string): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return `${Number(value.toFixed(1))} ${unit}`;
}

function formatReferenceDate(value: string): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : 'date unavailable';
}

export function buildCaddieReply(question: string, context: CaddieAdviceContext): string {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) {
    return 'Describe your lie, distance to the target and wind across your shot. For example: “Ball in right rough, 156 m out, wind left to right.”';
  }

  const lower = cleanQuestion.toLowerCase();
  const resolved = resolveShotConditions(cleanQuestion, context.shotConditions);
  if (resolved.error) return resolved.error;
  const lie = resolved.conditions.lie ?? inferShotLie(cleanQuestion);
  const rightOfGreen = /\bright(?:-|\s+)side\s+of\s+(?:the\s+)?green\b|\bright\s+of\s+(?:the\s+)?green\b/i.test(cleanQuestion);
  const leftOfGreen = /\bleft(?:-|\s+)side\s+of\s+(?:the\s+)?green\b|\bleft\s+of\s+(?:the\s+)?green\b/i.test(cleanQuestion);
  const leftToRight = /\bleft\s*(?:to|-)\s*right\b/i.test(cleanQuestion);
  const rightToLeft = /\bright\s*(?:to|-)\s*left\b/i.test(cleanQuestion);
  const hasWindMention = /\bwind\b/i.test(cleanQuestion);
  const distanceFromQuestion = parseDistanceMeters(cleanQuestion, context.unit);
  const liveDistanceMeters = context.liveDistanceMeters;
  const distanceMeters = distanceFromQuestion ?? (
    lie !== 'green' && typeof liveDistanceMeters === 'number' && Number.isFinite(liveDistanceMeters) && liveDistanceMeters > 0
      ? liveDistanceMeters
      : null
  );
  const distanceIsLive = distanceFromQuestion === null && distanceMeters !== null;
  const lines: string[] = [];
  if (context.shotConditions) {
    lines.push(`Comparison conditions: ${describeShotConditions(resolved.conditions)}. Only known matching requested tags are used; unspecified tags remain unknown. No fixed lie or wind carry multiplier is applied.`);
  }

  if (context.currentHole) {
    lines.push(`Hole ${context.currentHole}${context.par ? ` · par ${context.par}` : ''}.`);
  }
  if (lie || rightOfGreen || leftOfGreen) {
    const position = rightOfGreen ? 'right of the green' : leftOfGreen ? 'left of the green' : '';
    const lieLabel = lie === 'bunker' ? 'bunker' : lie === 'trees' ? 'tree trouble' : lie;
    lines.push(`You described ${[lieLabel, position].filter(Boolean).join(', ')}.`);
  }

  if (distanceMeters !== null) {
    lines.push(`${distanceIsLive ? 'Your live GPS distance' : 'Distance to the target'}: ${formatDistance(distanceMeters, context.unit)}.`);
    const usableClubs = context.clubs.filter((club) => Number.isFinite(club.carryMeters) && club.carryMeters > 0);
    const nearest = usableClubs.reduce<CaddieClub | null>((best, club) =>
      !best || Math.abs(club.carryMeters - distanceMeters) < Math.abs(best.carryMeters - distanceMeters) ? club : best,
    null);
    const personal = (context.shotProfiles ?? []).filter(profile => profile.count >= 5
      && (!context.shotConditions || (['lie', 'surface', 'wind'] as const).every(key => !resolved.conditions[key] || profile.conditions?.[key] === resolved.conditions[key]))
      && usableClubs.some(club => club.id === profile.clubId)
      && [profile.minCarry, profile.lowCarry, profile.medianCarry, profile.highCarry, profile.maxCarry, profile.lowSide, profile.medianSide, profile.highSide].every(Number.isFinite)
      && profile.minCarry > 0 && profile.minCarry <= profile.lowCarry && profile.lowCarry <= profile.medianCarry
      && profile.medianCarry <= profile.highCarry && profile.highCarry <= profile.maxCarry
      && profile.lowSide <= profile.medianSide && profile.medianSide <= profile.highSide);
    const limits = context.shotLimits;
    const invalidLimits = (limits?.minimumCarryMeters !== undefined && (!Number.isFinite(limits.minimumCarryMeters) || limits.minimumCarryMeters <= 0))
      || (limits?.maximumCarryMeters !== undefined && (!Number.isFinite(limits.maximumCarryMeters) || limits.maximumCarryMeters <= 0))
      || (limits?.minimumCarryMeters !== undefined && limits.maximumCarryMeters !== undefined && limits.minimumCarryMeters >= limits.maximumCarryMeters);
    const hasCarryLimits = limits?.minimumCarryMeters !== undefined || limits?.maximumCarryMeters !== undefined;
    const candidates = personal.filter(profile =>
      (limits?.minimumCarryMeters === undefined || profile.minCarry >= limits.minimumCarryMeters)
      && (limits?.maximumCarryMeters === undefined || profile.maxCarry <= limits.maximumCarryMeters));
    const cost = (profile: ShotProfile) => Math.abs(profile.medianCarry - distanceMeters)
      + 0.25 * (profile.highCarry - profile.lowCarry)
      + 0.5 * (profile.highSide - profile.lowSide)
      + 0.75 * Math.abs(profile.medianSide)
      + (limits?.troubleSide === 'right' ? 2 * Math.max(0, profile.highSide)
        : limits?.troubleSide === 'left' ? 2 * Math.max(0, -profile.lowSide) : 0);
    candidates.sort((a, b) => cost(a) - cost(b) || b.count - a.count);
    const restrictedLie = lie === 'rough' || lie === 'bunker' || lie === 'trees' || lie === 'green';
    if (invalidLimits) {
      lines.push('Invalid carry limits: enter positive distances with the minimum below the maximum. I will not select a club from these limits.');
    } else if ((limits?.minimumCarryMeters !== undefined && distanceMeters < limits.minimumCarryMeters)
      || (limits?.maximumCarryMeters !== undefined && distanceMeters > limits.maximumCarryMeters)) {
      lines.push('The target distance falls outside your entered landing limits. Check the target distance and limits before selecting a club; I will not choose one from conflicting inputs.');
    } else if (restrictedLie) {
      lines.push('No normal-carry club recommendation from this lie. Recorded practice carries do not model rough, sand, obstructions or putting; choose a safe recovery or exit first.');
      if ((lie === 'rough' || lie === 'bunker') && candidates[0]?.conditions?.lie === lie) {
        const reference = candidates[0];
        const club = usableClubs.find(item => item.id === reference.clubId)!;
        lines.push(`Condition-matched practice reference, not a club recommendation: ${club.name}, median ${formatDistance(reference.medianCarry, context.unit)} from ${reference.count} recorded shots with ${describeShotConditions(reference.conditions)}. Ball depth, grass/sand texture and swing intent can still differ; this does not establish a safe route or reliable carry from the current lie.`);
      }
    } else if (candidates.length) {
      const best = candidates[0];
      const club = usableClubs.find(item => item.id === best.clubId)!;
      const label = [club.name, club.make, club.model].filter(Boolean).join(' ');
      lines.push(`Personal carry comparison: ${label}. Median ${formatDistance(best.medianCarry, context.unit)}; central 80% of recorded carries ${formatDistance(best.lowCarry, context.unit)}–${formatDistance(best.highCarry, context.unit)} from ${best.count} shots (latest ${formatReferenceDate(best.lastRecordedAt)}).`);
      const sideLabel = Math.abs(best.medianSide) < 0.5 ? 'on the target line' : `${formatDistance(Math.abs(best.medianSide), context.unit)} ${best.medianSide < 0 ? 'left' : 'right'}`;
      lines.push(`Recorded miss pattern: median ${sideLabel}; central lateral spread ${formatDistance(best.highSide - best.lowSide, context.unit)}. Compared with other recorded clubs, the ranking balances distance match, carry spread and lateral spread, including your typical miss${limits?.troubleSide ? `, with extra weight against your stated ${limits.troubleSide}-side trouble` : ''}.`);
      if (hasCarryLimits) lines.push(`All ${best.count} considered carries fit your entered carry limits. This is a historical check, not a guarantee of clearing a hazard; the central 80% range excludes extreme shots.`);
      if (distanceMeters < best.minCarry || distanceMeters > best.maxCarry) {
        lines.push(`The target is ${distanceMeters > best.maxCarry ? 'beyond' : 'shorter than'} this club’s full observed carry range (${formatDistance(best.minCarry, context.unit)}–${formatDistance(best.maxCarry, context.unit)}). This comparison is not a verified one-shot route; use a safe lay-up/shorter target or record an appropriate club or partial swing.`);
      }
      if (candidates[1]) {
        const alternative = candidates[1];
        const alternativeClub = usableClubs.find(item => item.id === alternative.clubId)!;
        lines.push(`Alternative recorded option: ${alternativeClub.name}, median ${formatDistance(alternative.medianCarry, context.unit)}, central carry range ${formatDistance(alternative.lowCarry, context.unit)}–${formatDistance(alternative.highCarry, context.unit)} (${alternative.count} shots). Compare the landing area before choosing.`);
      }
      lines.push(`Sample strength: ${best.count < 15 ? 'developing (5–14 recorded shots)' : 'larger recorded sample (15+ shots)'}. Uses up to the latest 40 manually recorded carry-and-side shots per club. These are descriptive ranges, not a predicted success percentage; practice lie, wind and equipment can differ.${!lie ? ' Confirm a fairway-like lie before using this comparison.' : ''}`);
    } else if (hasCarryLimits) {
      lines.push('No club with at least 5 recorded shots fits all your entered carry limits. I will not guess a hazard-clearing club from a bag carry alone. Record more suitable shots or choose a safe recovery route.');
    } else if (nearest) {
      const makeAndModel = [nearest.make?.trim(), nearest.model?.trim()].filter(Boolean).join(' ');
      const loft = typeof nearest.loft === 'number' && Number.isFinite(nearest.loft) ? `${nearest.loft}° loft` : '';
      const details = [makeAndModel, loft].filter(Boolean).join(' · ');
      lines.push(`Closest saved carry: ${nearest.name}${details ? ` (${details})` : ''}, ${formatDistance(nearest.carryMeters, context.unit)}. This is only the nearest number in your bag, not a guaranteed shot from this lie.`);
      lines.push('Limited personal data: record at least 5 carry-and-side shots for a club in Shot Pattern with matching requested conditions to enable its recorded-range comparison. Unknown tags do not prove a match. Bag carries may be starter or manually edited values, not verified measurements.');
    } else {
      lines.push('There are no saved club carries to match this distance, so I will not guess a club.');
    }
  }

  if (context.shotLimits?.troubleSide) {
    lines.push(`You marked trouble on the ${context.shotLimits.troubleSide}. Favor the centre or open ${context.shotLimits.troubleSide === 'right' ? 'left' : 'right'} side only if that landing area and start line are clear. I cannot locate the hazard or calculate a safe aim offset from its side alone.`);
  }

  if (lie === 'rough') {
    lines.push('From rough, check whether the ball is sitting down. If the lie is heavy, use a controlled swing and allow for less predictable carry.');
    lines.push('Practice focus: compare clean and sitting-down grass lies separately with controlled swings. Record the rough tag; do not calibrate rough from mat/fairway distances.');
  } else if (lie === 'bunker') {
    lines.push('From sand, choose a safe exit and account for the ball sitting down; a normal fairway carry may not apply.');
    lines.push('Practice focus: distinguish greenside splash exits from fairway-bunker strikes in your notes. Check the lip, ball depth and clear exit first; mat practice is not a sand calibration.');
  } else if (lie === 'trees') {
    lines.push('With tree trouble, prioritize a clear recovery route before trying to reach the green.');
    lines.push('Practice focus: rehearse controlled low recovery shots to open targets and record the tree-recovery tag. Do not assume a saved carry clears branches or a narrow gap.');
  } else if (lie === 'fairway') {
    lines.push('From the fairway, favor a balanced strike and a safe part of the green over a tight flag.');
    lines.push('Practice focus: build a repeatable grass baseline, keeping mat and different wind records separate when comparing carry.');
  } else if (lie === 'green') {
    lines.push('Putting plan: read slope and pace on the actual green, then choose a start line and comfortable speed. GPS to the mapped green reference is not a putt distance.');
    lines.push('Practice focus: use Putting Practice for pace and short-putt starts. Full-swing carry records do not calibrate green speed or break.');
  }

  if (rightOfGreen || leftOfGreen) {
    lines.push(`From ${rightOfGreen ? 'right' : 'left'} of the green, favor the centre or open side. I cannot see the flag position or hazards from here.`);
  }

  if (leftToRight) {
    lines.push('A left-to-right crosswind can move the ball right. If the left start line is clear, allow for the drift and favor the centre of the green.');
  } else if (rightToLeft) {
    lines.push('A right-to-left crosswind can move the ball left. If the right start line is clear, allow for the drift and favor the centre of the green.');
  } else if (hasWindMention && !context.wind) {
    lines.push('I do not have a usable wind direction. Tell me whether it is into, behind, or crossing left-to-right or right-to-left.');
  } else if (context.wind) {
    lines.push(`Course-area forecast: ${Math.round(context.wind.windKph)} km/h from ${compassDirectionLabel(context.wind.windDirection)}. That is a compass reading, not the wind angle along your shot line; check the wind at the ball.`);
  }

  const flight = context.recentFlight;
  if (flight) {
    const unit = flight.distanceUnit ?? context.unit;
    const values = [
      flight.ballSpeedMph !== undefined ? `ball speed ${formatMetric(flight.ballSpeedMph, 'mph')}` : null,
      flight.clubSpeedMph !== undefined ? `club speed ${formatMetric(flight.clubSpeedMph, 'mph')}` : null,
      flight.apex !== undefined ? `apex ${formatMetric(flight.apex, unit)}` : null,
      flight.carry !== undefined ? `carry ${formatMetric(flight.carry, unit)}` : null,
    ].filter(Boolean);
    if (values.length) lines.push(`Latest saved Flight reference (manual entry, ${formatReferenceDate(flight.createdAt)}): ${values.join(', ')}.`);
  }

  const impact = context.recentImpact;
  if (impact) {
    const values = [
      impact.clubPathDeg !== undefined ? `club path ${formatMetric(impact.clubPathDeg, '°')}` : null,
      impact.faceAngleDeg !== undefined ? `face angle ${formatMetric(impact.faceAngleDeg, '°')}` : null,
      impact.tempoRatio !== undefined ? `tempo ${formatMetric(impact.tempoRatio, ':1')}` : null,
      impact.maxForceBodyWeightPct !== undefined ? `max force ${formatMetric(impact.maxForceBodyWeightPct, '% body weight')}` : null,
      impact.torqueNm !== undefined ? `torque ${formatMetric(impact.torqueNm, 'Nm')}` : null,
      impact.forceTransferPct !== undefined ? `force transfer ${formatMetric(impact.forceTransferPct, '%')}` : null,
      impact.pressureLeftPct !== undefined ? `left pressure ${formatMetric(impact.pressureLeftPct, '%')}` : null,
      impact.pressureRightPct !== undefined ? `right pressure ${formatMetric(impact.pressureRightPct, '%')}` : null,
    ].filter(Boolean);
    if (values.length) lines.push(`Latest saved Impact reference (manual entry, ${formatReferenceDate(impact.createdAt)}): ${values.join(', ')}.`);
  }

  const phoneMotion = context.recentPhoneMotion;
  if (phoneMotion) {
    lines.push(
      `Latest phone-motion reference (${formatReferenceDate(phoneMotion.capturedAt)}): peak phone rotation ${formatMetric(phoneMotion.peakRotationDegPerSecond, '°/s')}, peak dynamic acceleration ${formatMetric(phoneMotion.peakDynamicAccelerationG, 'g')} over ${formatMetric(phoneMotion.durationMs / 1000, 's')}. These are device-motion measurements only, not club, impact or ball-flight measurements.`,
    );
  }

  if (!distanceMeters) {
    lines.push('Add the distance to the target if you want me to compare it with your saved club carries.');
  }
  if (!lie && !rightOfGreen && !leftOfGreen && !distanceMeters && !leftToRight && !rightToLeft) {
    lines.push('I give offline shot guidance from the details you provide; include your lie, distance and wind direction for a more specific plan.');
  }

  lines.push('Offline guidance only: I cannot assess exact lie, elevation, hazards or course conditions.');
  return lines.join('\n\n');
}
