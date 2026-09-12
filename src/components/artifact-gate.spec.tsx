import type { ReactElement } from 'react';
import type { Artifact, StatusRecord } from '@/artifact/artifact';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { narratedArtifact, okStatus } from '@/artifact/fixtures';
import { ArtifactGate } from './artifact-gate';

// Both malformed values are a real fixture with one field broken, which is what
// a hand-edit to the committed JSON actually looks like. A value built from
// scratch would fail on the first key and never exercise the paths below it.
const brokenArtifact = { ...narratedArtifact, generatedAt: 'yesterday' };
const brokenStatus = { ...okStatus, consecutiveFailures: -1 };

function content({ artifact, status }: { artifact: Artifact; status: StatusRecord }): ReactElement {
	return (
		<p>
			{`${artifact.plan.tasks.length} tasks, ${status.consecutiveFailures} failures`}
		</p>
	);
}

describe('artifactGate', () => {
	it('calls the render prop with both values parsed', () => {
		const children = vi.fn(content);

		render(<ArtifactGate artifact={narratedArtifact} status={okStatus}>{children}</ArtifactGate>);

		expect(children).toHaveBeenCalledTimes(1);
		expect(screen.getByText(`${narratedArtifact.plan.tasks.length} tasks, 0 failures`)).toBeDefined();
		expect(screen.queryByRole('alert')).toBeNull();
	});

	it('renders the error state when the artifact is malformed', () => {
		render(<ArtifactGate artifact={brokenArtifact} status={okStatus}>{content}</ArtifactGate>);

		expect(screen.getByRole('alert').textContent).toContain('generatedAt');
	});

	// The status record is the asymmetric one. Its parser throws where the
	// artifact's returns a value, and a reader should not be able to tell which
	// of the two files was edited by whether the page renders or explodes.
	it('renders the error state when the status record is malformed', () => {
		render(<ArtifactGate artifact={narratedArtifact} status={brokenStatus}>{content}</ArtifactGate>);

		expect(screen.getByRole('alert').textContent).toContain('consecutiveFailures');
	});

	// This is the acceptance criterion. Reading the markup would only prove the
	// error is on the page; the spy proves the route's own content was never
	// asked for, so there is no half-rendered Plan sitting beside the error.
	it('does not call the render prop when either value fails', () => {
		const onBrokenArtifact = vi.fn(content);
		const onBrokenStatus = vi.fn(content);

		render(<ArtifactGate artifact={brokenArtifact} status={okStatus}>{onBrokenArtifact}</ArtifactGate>);
		render(<ArtifactGate artifact={narratedArtifact} status={brokenStatus}>{onBrokenStatus}</ArtifactGate>);

		expect(onBrokenArtifact).not.toHaveBeenCalled();
		expect(onBrokenStatus).not.toHaveBeenCalled();
	});

	it('carries the failure sentence through to the error state', () => {
		render(<ArtifactGate artifact={brokenArtifact} status={okStatus}>{content}</ArtifactGate>);

		const alert = screen.getByRole('alert').textContent ?? '';

		expect(alert).toContain('artifact:');
		expect(alert).toContain('"yesterday"');
	});
});
