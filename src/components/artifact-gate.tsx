'use client';

import type { ReactElement, ReactNode } from 'react';
import type { Artifact, StatusRecord } from '@/artifact/artifact';
import { parseStatusRecord, safeParseArtifact } from '@/artifact/artifact';
import { ArtifactError } from './artifact-error';

interface Validated {
	artifact: Artifact;
	status: StatusRecord;
}

/**
 * The single place the committed Artifact becomes typed. A route imports the
 * JSON at build time and hands it here as raw values, and everything below the
 * gate is called with an `Artifact` and a `StatusRecord` that have already been
 * through the schemas, so nothing under a route needs the loader or a check of
 * its own.
 *
 * The parse runs again in the browser, even though the generation run validated
 * the same file, because the file is committed and a person can edit it. A
 * hand-edit to `data/artifact.json` between runs reaches a reader, and it should
 * reach them as the error state rather than as a page that half-renders.
 *
 * Failure is total on purpose. Anything rendered beside the error is a Task with
 * no checkable Citation behind it, which is the one thing this interface may not
 * show, so a bad parse never calls the render prop.
 */
export function ArtifactGate({
	artifact,
	status,
	children,
}: {
	artifact: unknown;
	status: unknown;
	children: (validated: Validated) => ReactNode;
}): ReactElement {
	const result = validate(artifact, status);

	if (!result.ok) {
		return <ArtifactError message={result.error} />;
	}

	return <>{children(result.value)}</>;
}

/**
 * Both values, parsed into one result.
 *
 * The two parsers report failure differently. `safeParseArtifact` returns it and
 * `parseStatusRecord` throws it, because every other caller of the status record
 * is a run that should stop on a bad one. A `safeParseStatusRecord` beside it
 * would be a second export to keep in step for this one caller, so this function
 * catches the throw instead. A malformed status record and a malformed Artifact
 * then land in the same place, carrying the same kind of sentence.
 */
function validate(artifact: unknown, status: unknown): { ok: true; value: Validated } | { ok: false; error: string } {
	const parsedArtifact = safeParseArtifact(artifact);
	if (!parsedArtifact.ok) {
		return parsedArtifact;
	}

	try {
		return { ok: true, value: { artifact: parsedArtifact.value, status: parseStatusRecord(status) } };
	}
	catch (cause) {
		// parseWith throws an Error carrying the composed sentence. The fallback
		// covers anything that reaches here without one, so the error state shows a
		// sentence rather than the word "undefined".
		return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
	}
}
