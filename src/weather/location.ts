/**
 * The property's coordinates and time zone, read from the generation
 * environment and nowhere else. ADR 0004
 * (docs/adr/0004-coordinates-never-enter-the-repository.md) is why: the
 * repository is public, so a committed lat/long is a published one. The
 * three env vars below are the entire surface the ADR asks for — no file in
 * this repo may carry a coordinate, and this module exists to make sure the
 * only way in is that boundary.
 *
 * `env` defaults to `process.env` so the spec can hand in a plain object
 * instead of mutating the real environment. Reading `process.env` anywhere
 * but that default would defeat the point of the parameter. Typed as
 * `Record<string, string | undefined>` rather than `NodeJS.ProcessEnv`
 * because Next's ambient typing requires `NODE_ENV` on that interface — a
 * requirement this module has no business imposing on a plain test fixture.
 */

export interface Location {
	latitude: number;
	longitude: number;
	timeZone: string;
}

/**
 * A blank or absent env var reads as `undefined` or `''` depending on how a
 * shell quoted it; both mean "nobody supplied this" and get the same
 * "not set" wording rather than one of them confusingly parsing as `NaN`.
 */
function isBlank(raw: string | undefined): raw is undefined {
	return raw === undefined || raw.trim() === '';
}

/**
 * Range-checks the parsed number, not just its shape. ADR 0004's whole
 * argument is that a wrong coordinate produces "a confidently wrong Plan"
 * silently — a typo that still parses as a number (95 instead of 35) is
 * exactly that failure mode, and only a range check catches it.
 */
function readCoordinate(env: Record<string, string | undefined>, name: string, min: number, max: number): number {
	const raw = env[name];
	if (isBlank(raw)) {
		throw new Error(`${name} is not set. Coordinates live only in the generation environment (see docs/adr/0004-coordinates-never-enter-the-repository.md) — set it before running.`);
	}

	const value = Number(raw);
	if (Number.isNaN(value)) {
		throw new TypeError(`${name} is set to '${raw}', which is not a number.`);
	}
	if (value < min || value > max) {
		throw new RangeError(`${name} is set to ${value}, which is outside the valid range of ${min} to ${max} — check for a typo before trusting the Plan this produces.`);
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
 * exactly the kind of confidently-wrong value ADR 0004 warns about — a
 * silent off-by-an-hour bucketing of the Planner's local days rather than a
 * loud failure. `UTC` is carved out because some ICU builds omit it from
 * `supportedValuesOf` despite `Intl.DateTimeFormat` accepting it correctly.
 */
function isIanaTimeZone(candidate: string): boolean {
	return candidate === 'UTC' || Intl.supportedValuesOf('timeZone').includes(candidate);
}

export function readLocationFromEnv(env: Record<string, string | undefined> = process.env): Location {
	const latitude = readCoordinate(env, 'ROOTSTOCK_LATITUDE', -90, 90);
	const longitude = readCoordinate(env, 'ROOTSTOCK_LONGITUDE', -180, 180);

	const rawTimeZone = env.ROOTSTOCK_TIME_ZONE;
	if (isBlank(rawTimeZone)) {
		throw new Error('ROOTSTOCK_TIME_ZONE is not set. Coordinates live only in the generation environment (see docs/adr/0004-coordinates-never-enter-the-repository.md) — set it before running.');
	}
	if (!isIanaTimeZone(rawTimeZone)) {
		throw new Error(`ROOTSTOCK_TIME_ZONE is set to '${rawTimeZone}', which is not a recognized IANA time zone (e.g. America/Chicago).`);
	}

	return { latitude, longitude, timeZone: rawTimeZone };
}
