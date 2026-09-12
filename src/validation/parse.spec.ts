import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseWith, safeParseWith } from './parse';

const petSchema = z.strictObject({
	name: z.string(),
	age: z.number(),
});

describe('parseWith', () => {
	it('returns the parsed value when it matches the schema', () => {
		const parse = parseWith(petSchema, 'pet');

		expect(parse({ name: 'Rex', age: 3 })).toEqual({ name: 'Rex', age: 3 });
	});

	it('throws an Error, not a ZodError, on failure', () => {
		const parse = parseWith(petSchema, 'pet');

		expect(() => parse({ name: 'Rex', age: 'three' })).toThrow(Error);
		try {
			parse({ name: 'Rex', age: 'three' });
			expect.unreachable('parse should have thrown');
		}
		catch (error) {
			expect(error).not.toBeInstanceOf(z.ZodError);
			expect((error as Error).message).not.toContain('ZodError');
		}
	});

	it('begins the message with the label', () => {
		const parse = parseWith(petSchema, 'pet');

		expect(() => parse({ name: 'Rex', age: 'three' })).toThrowError(/^pet: /);
	});

	// The whole point of parseWith over throwing Zod's own error is that a human (or a log
	// aggregator) can read the message and know exactly what broke without opening a debugger.
	it('names the failing path and the value that was actually received', () => {
		const parse = parseWith(petSchema, 'pet');

		expect(() => parse({ name: 'Rex', age: 'three' })).toThrowError(/age/);
		expect(() => parse({ name: 'Rex', age: 'three' })).toThrowError(/"three"/);
	});

	it('names a nested failing path for a nested schema', () => {
		const ownerSchema = z.strictObject({
			pet: petSchema,
		});
		const parse = parseWith(ownerSchema, 'owner');

		expect(() => parse({ pet: { name: 'Rex', age: 'three' } })).toThrowError(/pet\.age/);
		expect(() => parse({ pet: { name: 'Rex', age: 'three' } })).toThrowError(/"three"/);
	});

	it('reports the received value for an array element by index', () => {
		const listSchema = z.array(z.number());
		const parse = parseWith(listSchema, 'numbers');

		expect(() => parse([1, 'two', 3])).toThrowError(/\[1\]/);
		expect(() => parse([1, 'two', 3])).toThrowError(/"two"/);
	});
});

describe('safeParseWith', () => {
	it('returns ok: true with the parsed value on success', () => {
		const safeParse = safeParseWith(petSchema, 'pet');

		expect(safeParse({ name: 'Rex', age: 3 })).toEqual({ ok: true, value: { name: 'Rex', age: 3 } });
	});

	it('returns ok: false with the same message composition as parseWith, instead of throwing', () => {
		const safeParse = safeParseWith(petSchema, 'pet');

		const result = safeParse({ name: 'Rex', age: 'three' });

		expect(result.ok).toBe(false);
		if (result.ok) {
			expect.unreachable('expected ok: false');
		}
		expect(result.error).toMatch(/^pet: /);
		expect(result.error).toContain('age');
		expect(result.error).toContain('"three"');
	});
});
