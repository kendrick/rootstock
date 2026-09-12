import type { Observation } from './observation';
import type { fetchObservations } from './open-meteo';

/**
 * `open-meteo.ts` exports no named type for the function itself, only for its
 * options. Deriving the type here, rather than writing it by hand, means a
 * future change to `fetchObservations`'s signature breaks this file at
 * compile time instead of leaving a fake that quietly no longer matches what
 * every real caller accepts.
 */
type FetchObservations = typeof fetchObservations;

/**
 * Hands the generation pipeline's tests a known list of Observations without
 * touching the network or re-deriving the Open-Meteo mapping (ticket #9).
 *
 * `location` and `now` are accepted, to match `FetchObservations`, and then
 * ignored, on purpose. A test using this fake builds the Observations it
 * wants and asserts on what the pipeline did with them; honoring `now` here
 * would force every caller to construct a consistent clock just to get its
 * own data back unchanged.
 */
export function fakeObservations(observations: Observation[]): FetchObservations {
	return async () => observations;
}
