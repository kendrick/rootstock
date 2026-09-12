import { describe, expect, it } from 'vitest';
import { toGenerationFailure } from './failure';

describe('toGenerationFailure', () => {
	it('reads the message off a thrown Error', () => {
		const failure = toGenerationFailure('weather', new Error('open-meteo unreachable'));
		expect(failure).toEqual({ stage: 'weather', message: 'open-meteo unreachable' });
	});

	it('keeps a thrown string verbatim', () => {
		const failure = toGenerationFailure('plan', 'the rule set is empty');
		expect(failure).toEqual({ stage: 'plan', message: 'the rule set is empty' });
	});

	it('renders a thrown object as JSON', () => {
		const failure = toGenerationFailure('validate', { code: 'ARTIFACT_INVALID', path: 'plan.tasks[0]' });
		expect(failure).toEqual({ stage: 'validate', message: '{"code":"ARTIFACT_INVALID","path":"plan.tasks[0]"}' });
	});

	it('falls back to String() when JSON.stringify cannot render the value', () => {
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		const failure = toGenerationFailure('weather', circular);
		expect(failure).toEqual({ stage: 'weather', message: String(circular) });
	});
});
