import artifact from '../../data/artifact.json';
import status from '../../data/status.json';

/**
 * The only module a `page.tsx` may import for data. `output: 'export'` makes
 * this a build-time read baked into the bundle, not a request-time fetch, so
 * there is nothing below a route to await and no loading state to design for.
 *
 * The return type is `unknown`, not `Artifact` and `StatusRecord`, even though
 * `resolveJsonModule` lets TypeScript infer a precise structural type from the
 * JSON literals above. That inferred type is a lie the moment someone hand-edits
 * `data/artifact.json` or `data/status.json`, which is exactly the case this
 * architecture exists to survive: the files are committed, not generated at
 * request time, so nothing stops a bad edit from reaching a build. Widening the
 * return to `unknown` forces every caller through `ArtifactGate`, which is
 * where `safeParseArtifact` and `parseStatusRecord` actually run.
 *
 * A component below a route that imported this for itself would skip the gate
 * and render a Plan nobody parsed, so the gate is the only caller: everything
 * beneath it receives an already-validated `Artifact` and `StatusRecord`.
 */
export function loadArtifact(): { artifact: unknown; status: unknown } {
	return { artifact, status };
}
