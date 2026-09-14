import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
	createYardStore,
	figPlant,
	plannedPlant,
	plantFixtures,
	ruleFixtures,
	unplacedPlantedPlant,
	yardArtifact,
	yardFixture,
} from './fixtures';
import { Yard } from './yard';

function renderYard(): { unmount: () => void } {
	return render(
		<Yard
			yard={yardFixture}
			plants={plantFixtures}
			rules={ruleFixtures}
			artifact={yardArtifact}
			// Injected rather than defaulted: the sheet's own read would reach for
			// IndexedDB, which jsdom does not have.
			store={createYardStore()}
		/>,
	);
}

/** Waits out the store read the sheet starts on open, so the two sheets compared below are both finished rather than one mid-flight. */
async function settled(): Promise<void> {
	await waitFor(() => {
		expect(screen.queryByText(/Reading what has been recorded here/)).toBeNull();
	});
}

/**
 * A list row's accessible name is the Plant's name followed by its kind and
 * site, where a pin's is the name alone, so the row is matched on a prefix and
 * scoped to the list, which is what keeps the two apart while both are on
 * screen. A prefix function rather than a RegExp: seed names carry parentheses
 * ("Crossvine, porch trellis (west)"), and a name compiled straight into a
 * pattern matches nothing.
 */
function listRowFor(name: string): HTMLElement {
	return within(screen.getByRole('list', { name: 'Plants' })).getByRole('button', {
		name: accessibleName => accessibleName.startsWith(name),
	});
}

describe('yard', () => {
	it('renders the photo and the list together, with no sheet open', () => {
		renderYard();

		expect(screen.getByRole('img', { name: /seen from above/ })).toBeDefined();
		expect(screen.getByRole('list', { name: 'Plants' })).toBeDefined();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('opens the sheet for the Plant whose pin was clicked', async () => {
		renderYard();

		fireEvent.click(screen.getByTitle(figPlant.name));
		await settled();

		expect(screen.getByRole('heading', { name: figPlant.name })).toBeDefined();
	});

	/*
	 * The acceptance criterion, asserted as an equivalence rather than as two
	 * sheets that merely both open. The list exists because a planned Plant has
	 * no pin and the photo is no use to a keyboard or a screen reader, so a list
	 * that opened a thinner sheet would leave those readers a thinner yard.
	 */
	it('opens the same sheet from a pin and from a list row', async () => {
		const fromPin = renderYard();
		fireEvent.click(screen.getByTitle(figPlant.name));
		await settled();
		const pinSheet = screen.getByRole('dialog').textContent;
		fromPin.unmount();

		renderYard();
		fireEvent.click(listRowFor(figPlant.name));
		await settled();

		expect(screen.getByRole('dialog').textContent).toBe(pinSheet);
	});

	// A planned Plant carries no position and so has no pin at all. The list row
	// is its only way in, which is the reason the list is not a convenience.
	it('opens the sheet for a planned Plant, which has no pin', async () => {
		renderYard();

		expect(plannedPlant.position).toBeNull();
		fireEvent.click(listRowFor(plannedPlant.name));
		await settled();

		expect(screen.getByRole('heading', { name: plannedPlant.name })).toBeDefined();
	});

	it('opens the sheet for a planted Plant that was never sited', async () => {
		renderYard();

		fireEvent.click(listRowFor(unplacedPlantedPlant.name));
		await settled();

		expect(screen.getByRole('heading', { name: unplacedPlantedPlant.name })).toBeDefined();
	});

	// Closing has to clear the selection, not just hide the sheet: a selection
	// left behind would refuse to reopen the same Plant, since `open` is derived
	// from it and never changed.
	it('clears the selection when the sheet is closed, and reopens on the same Plant', async () => {
		renderYard();
		fireEvent.click(screen.getByTitle(figPlant.name));
		await settled();

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		fireEvent.click(screen.getByTitle(figPlant.name));
		await settled();

		expect(screen.getByRole('heading', { name: figPlant.name })).toBeDefined();
	});

	// The critique found `document.activeElement` at `body` after every close,
	// by Escape and by the Close button alike: the triggering pin or row never
	// got focus back. Radix restores focus to whatever it recorded as the
	// trigger on its own, but nothing here uses a Radix Trigger component, since
	// a pin and a row are two different elements for the one Plant, so Yard has
	// to track and restore it itself.
	it('returns focus to the pin that opened the sheet, once it closes', async () => {
		renderYard();

		const pin = screen.getByTitle(figPlant.name);
		fireEvent.click(pin);
		await settled();

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		expect(document.activeElement).toBe(pin);
	});

	// The list row is the other trigger the same sheet can open from, and the
	// fix has to restore to whichever one actually fired rather than always
	// preferring the pin.
	it('returns focus to the list row that opened the sheet, once it closes', async () => {
		renderYard();

		const row = listRowFor(plannedPlant.name);
		fireEvent.click(row);
		await settled();

		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		await waitFor(() => {
			expect(screen.queryByRole('dialog')).toBeNull();
		});

		expect(document.activeElement).toBe(row);
	});
});
