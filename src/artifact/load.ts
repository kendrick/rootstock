import artifact from '../../data/artifact.json';
import status from '../../data/status.json';

/**
 * The only module a `page.tsx` may import for data. `output: 'export'` makes
 * this a build-time read baked into the bundle, not a request-time fetch, so
 * there is nothing below a route to await and no loading state to design for.
 *
 * The return type is `unknown`, not `Artifact` and `StatusRecord`, even though
 * `resolveJsonModule` lets TypeScript infer a precise structural type from the
 * JSON literals above. That inferred type always matches the file, and matching
 * the file is the problem: it is a description of the bytes on disk, and it
 * carries none of the invariants the schemas enforce. `narrated` agreeing with
 * `narration`, a Citation's discriminant, an ISO instant that parses — a
 * structural type accepts a file that breaks all three, and hands a caller
 * field access that looks checked.
 *
 * `unknown` removes that field access, so the only way to read anything here is
 * to parse it. Convention decides where that happens, not the compiler: the
 * rule is that `ArtifactGate` is the one caller, because a component that
 * loaded this for itself would render a Plan nobody parsed.
 */
export function loadArtifact(): { artifact: unknown; status: unknown } {
	return { artifact, status };
}
