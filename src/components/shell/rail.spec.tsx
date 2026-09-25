import { act, render, screen, waitFor } from '@testing-library/react';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { narratedArtifact, okStatus } from '@/artifact/fixtures';
import { loadArtifact } from '@/artifact/load';
import { announceRecorded } from '@/components/this-week/recorded';
import { openBrowserStore } from '@/store/browser';
import { recordOccurrence } from '@/store/occurrence';
import { OpenCount, RailApparatus } from './rail';
// Installs IDBRequest and the other globals `idb` reaches for; each test then
// swaps in a fresh factory below.
import 'fake-indexeddb/auto';

vi.mock('@/artifact/load', () => ({ loadArtifact: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const total = narratedArtifact.plan.tasks.length;
const fired = narratedArtifact.plan.tasks[0];

beforeEach(() => {
	// A fresh database per test, so one test's sign-off is never the next one's history.
	globalThis.indexedDB = new IDBFactory();
	vi.mocked(loadArtifact).mockReturnValue({ artifact: narratedArtifact, status: okStatus });
});

afterEach(() => {
	vi.mocked(loadArtifact).mockReset();
});

async function renderRail(): Promise<void> {
	await act(async () => {
		render(<RailApparatus />);
	});
}

function openFigure(): string | null {
	const term = screen.queryByText('Open', { selector: 'dt' });
	return term?.nextElementSibling?.textContent ?? null;
}

describe('railApparatus', () => {
	it('counts every Task open when this browser has recorded none', async () => {
		await renderRail();

		await waitFor(() => expect(openFigure()).toBe(String(total)));
	});

	/*
	 * A margin that never re-counts says every Task is open beside a stub
	 * saying one fewer. The figure has to move when the Task list says an
	 * Occurrence landed.
	 */
	it('drops the open figure once a sign-off lands', async () => {
		if (fired === undefined) {
			throw new Error('the artifact fixture carries no Task to sign off');
		}
		await renderRail();
		await waitFor(() => expect(openFigure()).toBe(String(total)));

		const store = await openBrowserStore();
		await recordOccurrence(store, {
			ruleId: fired.ruleId,
			plantId: fired.plantId,
			completedAt: `${narratedArtifact.plan.asOf}T12:00:00Z`,
		});
		act(() => {
			announceRecorded();
		});

		await waitFor(() => expect(openFigure()).toBe(String(total - 1)));
	});

	// A count nobody can vouch for is worse than none. The page says in words
	// that the Store is unavailable; the margin just leaves the figure out.
	it('leaves the open figure out when the Store will not open', async () => {
		globalThis.indexedDB = undefined as unknown as IDBFactory;
		await renderRail();
		await act(async () => {});

		expect(openFigure()).toBeNull();
		expect(screen.getByText('Tasks', { selector: 'dt' })).toBeDefined();
	});

	// The phone's figure beside the heading reads the same count as the margin.
	it('shows the open count beside the heading once the Store answers', async () => {
		await act(async () => {
			render(<OpenCount />);
		});

		await waitFor(() => expect(screen.getByText(`${total} of ${total} open`)).toBeDefined());
	});
});
