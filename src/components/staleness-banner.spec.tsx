import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { approachingArtifact, failingStatus, narratedArtifact, okStatus } from '@/artifact/fixtures';
import { StalenessBanner } from './staleness-banner';

const HOUR_MS = 60 * 60 * 1000;
const GENERATED_AT = narratedArtifact.generatedAt;

/**
 * Every band below is driven by moving `now` away from a fixture's real
 * `generatedAt`, never by handing the component a Staleness object built by
 * hand. A test that supplied the band would pass on a banner that had quietly
 * grown its own copy of the 36-hour line; this way the component and
 * `staleness()` have to agree.
 */
function hoursAfter(generatedAt: string, hours: number): Date {
	return new Date(Date.parse(generatedAt) + hours * HOUR_MS);
}

/** ICU puts a narrow no-break space before AM/PM, which no reader can see and no regex written by hand expects. */
function readable(text: string | null | undefined): string {
	return (text ?? '').replace(/[\u202F\u00A0]/g, ' ');
}

describe('stalenessBanner', () => {
	it('renders nothing at all while the data is fresh and the runs are landing', () => {
		const { container } = render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 12)} />,
		);

		expect(container.innerHTML).toBe('');
		expect(screen.queryByRole('status')).toBeNull();
	});

	// Age and runner health are separate signals. A run can fail overnight while
	// yesterday's Artifact is still current, and that is the case the count on
	// the status record exists to surface—waiting for the file to age out of
	// the fresh band would hold the news back for most of a day.
	it('names the failed runs on fresh data, without a word about the age', () => {
		render(
			<StalenessBanner generatedAt={GENERATED_AT} status={failingStatus} now={hoursAfter(GENERATED_AT, 12)} />,
		);

		const banner = screen.getByRole('status');
		expect(readable(banner.textContent)).toContain('The last 3 runs failed');
		// The half that must stay quiet: nothing about when the plan was made.
		expect(readable(banner.textContent)).not.toContain('This plan is from');
		expect(banner.querySelector('time')).toBeNull();
	});

	it('names the generation time in words once the data is stale', () => {
		render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);

		const banner = screen.getByRole('status');
		expect(readable(banner.textContent)).toMatch(/^This plan is from [A-Z][a-z]+day, [A-Z][a-z]+ \d{1,2} at \d{1,2}:\d{2} [AP]M\./);
		// The raw timestamp belongs in the markup, not in front of a reader.
		expect(banner.textContent).not.toContain(GENERATED_AT);
	});

	it('keeps the machine-readable timestamp on the time element', () => {
		const { container } = render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);

		expect(container.querySelector('time')?.getAttribute('datetime')).toBe(GENERATED_AT);
	});

	// Persistent is the requirement, and a dismiss control is the usual way it
	// gets lost: clicking the notice away does not make the Tasks underneath
	// any less out of date.
	it('offers nothing to dismiss', () => {
		render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);

		expect(screen.queryByRole('button')).toBeNull();
	});

	it('says so in as many words once the plan is past a week', () => {
		const expiredAt = approachingArtifact.generatedAt;
		render(
			<StalenessBanner generatedAt={expiredAt} status={okStatus} now={hoursAfter(expiredAt, 24 * 10)} />,
		);

		expect(screen.getByRole('status').textContent).toContain('more than a week ago');
	});

	it('renders the expired band louder than the stale one', () => {
		const { container: stale } = render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);
		const { container: expired } = render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 24 * 10)} />,
		);

		const staleClass = stale.firstElementChild?.getAttribute('class');
		const expiredClass = expired.firstElementChild?.getAttribute('class');

		expect(expiredClass).not.toBe(staleClass);
	});

	// The count, not just the age: "the last three runs failed" sends someone to
	// look at the box, where "this data is old" does not.
	it('names how many runs have failed in a row', () => {
		render(
			<StalenessBanner generatedAt={GENERATED_AT} status={failingStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);

		const text = screen.getByRole('status').textContent ?? '';
		expect(text).toContain(`The last ${failingStatus.consecutiveFailures} runs failed`);
	});

	it('says nothing about failures when the runner is healthy', () => {
		render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);

		expect(screen.getByRole('status').textContent).not.toContain('failed');
	});

	it('renders a prominent variant for the Away Card without changing what it says', () => {
		const { container: plain } = render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} />,
		);
		const { container: card } = render(
			<StalenessBanner generatedAt={GENERATED_AT} status={okStatus} now={hoursAfter(GENERATED_AT, 48)} prominent />,
		);

		const plainClass = plain.firstElementChild?.getAttribute('class');
		const cardClass = card.firstElementChild?.getAttribute('class');

		expect(cardClass).not.toBe(plainClass);
		expect(readable(card.textContent)).toBe(readable(plain.textContent));
		expect(card.querySelector('[role="status"]')).not.toBeNull();
	});

	// The default has to be read on each render rather than once when the module
	// loads, or a tab left open over a weekend keeps reporting the age it had
	// when the bundle was parsed.
	it('falls back to the current instant when no now is given', () => {
		const { container: old } = render(
			<StalenessBanner generatedAt={new Date(Date.now() - 24 * 10 * HOUR_MS).toISOString()} status={okStatus} />,
		);
		const { container: justNow } = render(
			<StalenessBanner generatedAt={new Date().toISOString()} status={okStatus} />,
		);

		expect(old.textContent).toContain('more than a week ago');
		expect(justNow.innerHTML).toBe('');
	});
});
