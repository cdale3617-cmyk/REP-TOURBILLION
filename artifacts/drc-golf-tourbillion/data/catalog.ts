export type AppTool = {
  slug: string;
  title: string;
  icon: string;
  description: string;
  howTo: string[];
};

export const labTools: AppTool[] = [
  {
    slug: 'swing-monitor',
    title: 'Swing Monitor',
    icon: 'video',
    description: 'Capture phone movement at the waist and review swing clips. Use external readings for actual club and impact measurements.',
    howTo: ['For video review, place the phone on a stable tripod behind you or face-on; the camera records video only.', 'For motion capture, secure the phone at your waist before swinging. It records phone movement only; do not hold it or attach it to a club.', 'Enter actual club, impact, force, or pressure readings only when supplied by a validated external source.'],
  },
  {
    slug: 'shot-tracer',
    title: 'Shot Tracer',
    icon: 'crosshair',
    description: 'Record a shot clip and enter ball speed, club speed, apex, and carry from an external monitor.',
    howTo: ['Record or choose a shot video; the camera does not measure the ball flight.', 'Enter readings supplied by a launch monitor or coach. Smash factor is calculated from the speeds you enter.', 'Review the saved flight profile, which is illustrative and not a physics simulation. Use Shot Pattern for carry and lateral dispersion.'],
  },
  {
    slug: 'shot-pattern',
    title: 'Shot Pattern / Dispersion',
    icon: 'target',
    description: 'Record measured carry and left/right miss for one club at a time.',
    howTo: ['Choose the club you hit; new shots stay linked to that club after a rename.', 'Enter measured carry and lateral offset: left is negative, right is positive, target is zero.', 'Record at least 5 shots per club to enable personal carry-range and miss-pattern comparisons in Caddie. It uses up to your latest 40 shots, with no automatic ball measurement.', 'New shots record make, model and loft; changing that setup excludes those shots from the current profile. Older name-only records have no setup history and require a unique name match.'],
  },
  {
    slug: 'putting-practice',
    title: 'Putting Practice',
    icon: 'circle',
    description: 'Track makes and misses from a chosen putting distance.',
    howTo: ['Set the distance, then hit putts from the same spot.', 'Tap Made or Missed once after each putt.', 'Save the set before leaving to keep its count on this device.'],
  },
  {
    slug: 'short-game',
    title: 'inside 100m',
    icon: 'flag',
    description: 'Track short-game practice reps from inside 100 m, with a session note.',
    howTo: ['Log one rep after each short-game attempt.', 'Use the session note for your club, target, or contact.', 'Save the set to keep the practice record on this device.'],
  },
  {
    slug: 'wedge-matrix',
    title: 'Wedge Distances / Wedge Matrix',
    icon: 'grid',
    description: 'Save full, three-quarter and half-swing carries for each wedge.',
    howTo: ['Add your wedges and full carries in Bag.', 'Measure half and three-quarter carries on the range; leave unknown distances blank.', 'Enter each measured distance and tap Save wedge distances.'],
  },
  {
    slug: 'greenside-chipping',
    title: 'Greenside Chipping',
    icon: 'corner-up-right',
    description: 'Count greenside chip reps and keep a simple session note.',
    howTo: ['Pick a landing spot just onto the green and one club.', 'Tap Log a rep after each chip; use the note for rollout or contact.', 'Save the set when you finish.'],
  },
  {
    slug: 'green-reading',
    title: 'Greenslope / Green Reading',
    icon: 'activity',
    description: 'Keep a green photo with your own line, slope and pace note.',
    howTo: ['Capture or choose a photo when asked; access is only requested when tapped.', 'Read from behind the ball and note the slope and pace you see.', 'Save your note and selected photo together. Saved green reads reopen from private local storage; the photo is not a slope measurement.', 'Export saved photos separately before changing devices. Golf JSON backups include notes and photo references, not image files.'],
  },
  {
    slug: 'biometrics',
    title: 'Biometrics',
    icon: 'heart',
    description: 'Read synced Galaxy Watch measurements through Health Connect, connect an optional standard BLE heart-rate monitor, or use the separate manual log.',
    howTo: ['In a native Android build, sync your Galaxy Watch with Samsung Health and enable Health Connect sharing for heart rate and oxygen saturation.', 'Tap Allow access / refresh readings and grant read permissions. Check each reading’s source and timestamp; synced watch measurements are not live.', 'If you have a separate standard BLE heart-rate monitor, wake and wear it, scan, choose it and connect. Disconnect when finished; no separate monitor is required for Galaxy Watch health sync.', 'As a manual alternative, enter only measured heart rate and SpO₂ values and save them to the separate on-device log.'],
  },
  {
    slug: 'score-comparison',
    title: 'Round Performance Coach',
    icon: 'bar-chart-2',
    description: 'Track putting, fairways, greens and penalties, compare matching cards and choose a practice focus.',
    howTo: ['Record total scores in Round, then optionally save putts, penalties, fairway and green-in-regulation results per hole.', 'Unknown statistics stay unknown; zero putts or penalties must be entered explicitly. Penalty strokes are already included in your total score.', 'Finish the round to include it here. You can correct statistics on a saved scorecard.', 'Scoring trends require the same course, scored holes and pars. Practice priorities use at least 3 tracked relevant holes and are early signals, not precise strokes gained.'],
  },
  {
    slug: 'round-overview',
    title: 'Round Overview',
    icon: 'pie-chart',
    description: 'Review the score, course, holes, and pace of the active or most recent round.',
    howTo: ['Open the active round to see live scoring.', 'If no round is active, the latest saved round is shown.', 'Save the scorecard from Round when you finish playing.'],
  },
  {
    slug: 'pre-round',
    title: 'Pre-Round',
    icon: 'check-square',
    description: 'Check your tee time, course weather, equipment and warm-up before play.',
    howTo: ['Confirm your tee time and check-in with the course; this tool does not book or verify reservations.', 'Review current course-area weather and check course conditions with the club. Current weather is not a forecast for your tee time.', 'Tap each preparation item to mark it complete. Progress is saved on this device; untick items to check them again before your next round.'],
  },
  {
    slug: 'club-equipment',
    title: 'Club Equipment',
    icon: 'sliders',
    description: 'Review club setup and carry numbers from your editable bag.',
    howTo: ['Edit club names, carry distances, and lofts in Bag.', 'Select metres or yards from the Bag screen.', 'Use this view as a quick equipment check before play.'],
  },
  {
    slug: 'round-history',
    title: 'Round History',
    icon: 'clock',
    description: 'Browse scorecards saved on this device.',
    howTo: ['Save a scorecard at the end of a round.', 'Open a past round to see its course and hole-by-hole score.', 'Round history is stored locally on this device.'],
  },
];

export const moreTools: AppTool[] = [
  {
    slug: 'scorecard',
    title: 'Scorecard',
    icon: 'clipboard',
    description: 'Review the current scorecard or your most recent saved round.',
    howTo: ['Record a total score for each hole in Round.', 'Use the table to check par and completed holes.', 'Save the round, then review or correct optional hole statistics here. Blank statistics mean unknown, not zero.', 'Open Round Performance Coach from Lab or Round to see tracked coverage, matching-card trends and a practice focus.'],
  },
  {
    slug: 'strokes-gained',
    title: 'Strokes Gained',
    icon: 'trending-up',
    description: 'Log start and finish distances to estimate strokes gained against a simple reference curve.',
    howTo: ['Enter the starting and ending distance in yards.', 'Save the shot result to your local analysis log.', 'The estimate uses a simplified reference model, not tour-grade course data.'],
  },
  {
    slug: 'fusion',
    title: 'Fusion',
    icon: 'layers',
    description: 'Bring saved rounds, club carries, and practice notes together in one summary.',
    howTo: ['Save round scores and add practice activity.', 'Review the combined summary for patterns.', 'Use the insights as a prompt for your next practice session.'],
  },
  {
    slug: 'records',
    title: 'Records',
    icon: 'award',
    description: 'See personal bests calculated from scorecards saved on this device.',
    howTo: ['Save completed scorecards to build your record list.', 'Records update automatically from local round history.', 'Only recorded scores are included.'],
  },
  {
    slug: 'course-library',
    title: 'Course Library',
    icon: 'map',
    description: 'Browse local course references or look up nearby golf courses and contact details from OpenStreetMap.',
    howTo: ['Allow location when asked to search near you.', 'Tap Find nearby courses to query the public course directory.', 'Select a result to set it as your current course.'],
  },
  {
    slug: 'course-information',
    title: 'Course Information',
    icon: 'info',
    description: 'See course location and any contact details available in the course directory.',
    howTo: ['Choose a course from the library.', 'Review its address, phone, and website when those details are listed.', 'Directory contact fields can be incomplete; confirm with the course before visiting.'],
  },
  {
    slug: 'settings',
    title: 'Settings & Connections',
    icon: 'settings',
    description: 'Manage units and review device permission and connection status.',
    howTo: ['Choose your preferred carry-distance unit in Bag.', 'Grant camera and location access only when using those tools.', 'Health-platform and BLE connections need native integrations that are not available in this preview.'],
  },
  {
    slug: 'how-to',
    title: 'How To Guides',
    icon: 'book-open',
    description: 'Short guides for every Golf Lab tool.',
    howTo: ['Choose any tool below.', 'Read the quick steps before your session.', 'Open the tool itself when you are ready to record.'],
  },
];

export const preRoundItems = [
  'Tee time and check-in confirmed',
  'Weather and course conditions checked',
  'Local rules board checked',
  'Clubs and bag ready',
  'Golf balls and tees packed',
  'Rangefinder or GPS charged',
  'Water and weather layer packed',
  'Sunscreen and hat packed',
  'Warm-up and putting completed',
];