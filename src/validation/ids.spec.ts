import type { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { KEBAB_ID_PATTERN, kebabIdSchema } from '@/validation/ids';

/**
 * `kebabIdSchema` is `z.string().regex(...)`, and Zod 4 stores the compiled `RegExp` on the check rather than on the schema itself. Reaching it by name, instead of only checking that sample strings parse, is what proves the schema was built out of `KEBAB_ID_PATTERN` and not out of a hand-copied literal that accepts the same samples today and drifts tomorrow. A Zod upgrade that moves the check fails here, loudly, which is the right place for it to fail.
 */
function regexCheckPattern(schema: z.ZodString): RegExp {
	const check = schema.def.checks?.[0] as { _zod: { def: { pattern: RegExp } } } | undefined;
	if (!check) {
		throw new Error('expected a regex check on the schema');
	}
	return check._zod.def.pattern;
}

describe('the exported pattern string', () => {
	it('is the bare character class, not a compiled RegExp', () => {
		expect(KEBAB_ID_PATTERN).toBe('[a-z0-9-]+');
	});
});

describe('kebabIdSchema', () => {
	it('composes to the exact kebab-id regex source', () => {
		expect(regexCheckPattern(kebabIdSchema).source).toBe('^[a-z0-9-]+$');
		expect(new RegExp(`^${KEBAB_ID_PATTERN}$`).source).toBe('^[a-z0-9-]+$');
	});

	it.each(['prune-roses-spring', 'a', '123'])('accepts %s', (value) => {
		expect(kebabIdSchema.safeParse(value).success).toBe(true);
	});

	it.each(['Rule', 'has_underscore', 'has space', '', 'rule@plant'])('rejects %s', (value) => {
		expect(kebabIdSchema.safeParse(value).success).toBe(false);
	});
});

describe('the taskIdSchema shape recomposed from KEBAB_ID_PATTERN', () => {
	// `src/planner/task.ts` composes its own schema out of `KEBAB_ID_PATTERN` this same way. Asserting the source string here rather than importing `taskIdSchema` keeps `src/validation/` a leaf that imports only zod, and the five accept/reject cases in `task.spec.ts` pin the behaviour at the other end.
	it('matches the rule-id, optionally @-joined to a plant-id, source string verbatim', () => {
		const composed = new RegExp(`^${KEBAB_ID_PATTERN}(@${KEBAB_ID_PATTERN})?$`);
		expect(composed.source).toBe('^[a-z0-9-]+(@[a-z0-9-]+)?$');
	});
});
