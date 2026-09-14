/**
 * MM-DD range membership, comparing lexically rather than converting to a
 * day-of-year number. Both halves are zero-padded ('09-01', not '9-1'), so
 * string comparison agrees with calendar order for every pair within a
 * single year. That's what makes the wrap check below a plain three-way
 * comparison instead of arithmetic on month/day parts.
 *
 * A Window Rule like fall pre-emergent can straddle the year boundary
 * ("11-15" through "02-15"), so `end < start` is not an input error — it's
 * the signal that the range wraps. In that case the range covers everything
 * from `start` to '12-31' plus everything from '01-01' to `end`, which is
 * the same as saying `date` matches if it's on either side of the gap
 * between `end` and `start` rather than between them.
 */
export function isWithinMonthDayRange(date: string, start: string, end: string): boolean {
	const monthDay = date.slice(5);

	if (start <= end) {
		return monthDay >= start && monthDay <= end;
	}

	return monthDay >= start || monthDay <= end;
}

/**
 * `Intl.DateTimeFormat`'s 'en-CA' locale happens to format dates as
 * YYYY-MM-DD today, but that's a locale behavior, not a contract — nothing
 * stops it from changing. `formatToParts` reads the year/month/day fields
 * directly off the formatter and assembles the string by hand, so this
 * function's output can't drift if a locale's punctuation or field order
 * ever does.
 */
export function localDate(instant: string, timeZone: string): string {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	});

	const parts = formatter.formatToParts(new Date(instant));
	const year = parts.find(part => part.type === 'year')?.value;
	const month = parts.find(part => part.type === 'month')?.value;
	const day = parts.find(part => part.type === 'day')?.value;

	return `${year}-${month}-${day}`;
}

/**
 * Both dates are parsed as UTC midnight rather than local midnight, so the
 * subtraction is never contaminated by the day either calendar date's own
 * time zone would have had — one that this function is never told
 * and has no business assuming. That's also why it's exact across a DST
 * boundary: a local calendar day that was 23 or 25 hours long never enters
 * the computation, because these two instants are always exactly N * 24
 * hours apart for whole-day N.
 */
export function daysBetween(from: string, to: string): number {
	const millisPerDay = 24 * 60 * 60 * 1000;
	const fromMillis = Date.parse(`${from}T00:00:00Z`);
	const toMillis = Date.parse(`${to}T00:00:00Z`);

	return Math.round((toMillis - fromMillis) / millisPerDay);
}

/**
 * A caller indexes this with `Number(monthDay.slice(0, 2)) - 1`, so the array's zero-based position has to line up with a one-based MM string rather than with a calendar the reader carries in their head.
 */
export const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];
