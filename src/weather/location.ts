/**
 * The property's coordinates and time zone, read from the generation
 * environment and nowhere else. ADR 0004
 * (docs/adr/0004-coordinates-never-enter-the-repository.md) is why: the
 * repository is public, so a committed lat/long is a published one. The
 * coordinates below are the entire surface the ADR asks for: no file in this
 * repo may carry one, and this module exists to make sure the only way in is
 * that boundary. `ROOTSTOCK_TIME_ZONE` rides along because the same generation
 * run needs it and the same boundary is the honest place to read it, not
 * because ADR 0004 asks for it.
 */
export interface Location {
	latitude: number;
	longitude: number;
	timeZone: string;
}

/**
 * An absent variable and a blank one are the same failure wearing different
 * shells, so they share one message. Returning the validated string rather
 * than reporting blankness keeps every caller from re-deriving the check, and
 * avoids a type predicate that would have to claim `'   '` is `undefined`.
 */
function requireVariable(env: Record<string, string | undefined>, name: string): string {
	const raw = env[name];
	if (raw === undefined || raw.trim() === '') {
		throw new Error(`${name} is not set. The generation environment is the only place it exists (see docs/adr/0004-coordinates-never-enter-the-repository.md); set it before running.`);
	}

	return raw;
}

/**
 * Range-checks the parsed number, not just its shape. ADR 0004's whole
 * argument is that a wrong coordinate produces "a confidently wrong Plan"
 * silently—a typo that still parses as a number (95 instead of 35) is
 * exactly that failure mode, and only a range check catches it.
 */
function readCoordinate(env: Record<string, string | undefined>, name: string, min: number, max: number): number {
	const raw = requireVariable(env, name);

	const value = Number(raw);
	if (Number.isNaN(value)) {
		throw new TypeError(`${name} is set to '${raw}', which is not a number.`);
	}
	if (value < min || value > max) {
		throw new RangeError(`${name} is set to ${value}, which is outside the valid range of ${min} to ${max}; check for a typo before trusting the Plan this produces.`);
	}

	return value;
}

/**
 * `Intl.supportedValuesOf('timeZone')` carries the IANA time zone database
 * already loaded for `Intl.DateTimeFormat`, so a typo'd zone
 * (`America/Chigaco`) is caught for free, without adding a dependency just
 * to validate a string. `Intl.DateTimeFormat` itself is not used for this
 * check: it also accepts legacy fixed-offset abbreviations like `CST` that
 * are not IANA identifiers and do not observe daylight saving, which is
 * exactly the kind of confidently-wrong value ADR 0004 warns about—a
 * silent off-by-an-hour bucketing of the Planner's local days rather than a
 * loud failure. `UTC` is carved out because some ICU builds omit it from
 * `supportedValuesOf` despite `Intl.DateTimeFormat` accepting it correctly.
 */
function isIanaTimeZone(candidate: string): boolean {
	return candidate === 'UTC' || Intl.supportedValuesOf('timeZone').includes(candidate);
}

function readTimeZone(env: Record<string, string | undefined>, name: string): string {
	const raw = requireVariable(env, name);
	if (!isIanaTimeZone(raw)) {
		throw new Error(`${name} is set to '${raw}', which is not a recognized IANA time zone (e.g. America/Chicago).`);
	}

	return raw;
}

/**
 * `env` is a parameter so the spec can hand in a plain object instead of
 * mutating the real environment; reading `process.env` anywhere but its
 * default would defeat that. It is typed `Record<string, string | undefined>`
 * rather than `NodeJS.ProcessEnv` because Next's ambient typing requires
 * `NODE_ENV` on that interface, which this module has no business imposing on
 * a test fixture.
 *
 * The three reads run in order and the first failure throws, so the message
 * names one variable. A message listing all three would leave the reader
 * guessing which one the shell actually dropped.
 */
export function readLocationFromEnv(env: Record<string, string | undefined> = process.env): Location {
	return {
		latitude: readCoordinate(env, 'ROOTSTOCK_LATITUDE', -90, 90),
		longitude: readCoordinate(env, 'ROOTSTOCK_LONGITUDE', -180, 180),
		timeZone: readTimeZone(env, 'ROOTSTOCK_TIME_ZONE'),
	};
}
