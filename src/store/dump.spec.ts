import type { StoredRecord } from './store';
import type { Yard } from '@/yard/plant';
import { describe, expect, it } from 'vitest';
import { tagPolicySchema } from '@/rules/rule';
import { dumpSchema, envelopeSchema, parseDump } from './dump';
import { TAG_POLICY_ID } from './store';

/*
 * A dump is the one file a person moves between browsers by hand, so it is
 * also the one a person can corrupt by hand. Everything below is a shape that
 * would otherwise be discovered halfway through an import, with some records
 * already written.
 *
 * The payload is built here rather than imported from store.spec.ts: that
 * module carries the conformance suite and runs it on import, which would
 * report the whole scaffold suite a second time inside this file.
 */

const region = { name: 'Denton County, Texas', hardinessZone: '8a' };

function envelope(id: string, record: unknown) {
	return { id, updatedAt: '2026-09-12T15:04:00Z', source: 'seed', record };
}

const validDump = {
	version: 1,
	exportedAt: '2026-09-12T15:04:00Z',
	collections: {
		yard: [envelope('home-yard', { id: 'home-yard', region, photo: null, overlays: [] })],
		plants: [envelope('fig-1', {
			id: 'fig-1',
			name: 'Brown turkey fig',
			kind: 'plant',
			status: 'planted',
			tags: ['fruit'],
			position: null,
			site: 'northwest corner',
			lawn: null,
			notes: null,
		})],
		rules: [],
		occurrences: [],
		tagPolicy: [envelope(TAG_POLICY_ID, { neverDelegableTags: ['chemical'], safetyTags: ['chemical'] })],
	},
};

describe('dumpSchema', () => {
	// Guards every rejection below: if the fixture stopped parsing, they would
	// all still pass and none of them would be testing what it claims to.
	it('accepts a well-formed dump', () => {
		expect(dumpSchema.safeParse(validDump).success).toBe(true);
	});

	it('parses into the envelope shape the store interface declares', () => {
		const yardRows: StoredRecord<Yard>[] = dumpSchema.parse(validDump).collections.yard;

		expect(yardRows.map(row => row.record.id)).toEqual(['home-yard']);
	});

	it('refuses a version it does not know', () => {
		const result = dumpSchema.safeParse({ ...validDump, version: 2 });

		expect(result.success).toBe(false);
		expect(result.error?.issues.map(issue => issue.path.join('.'))).toContain('version');
	});

	it('refuses an unknown key on the envelope', () => {
		const rows = [{ ...envelope('home-yard', validDump.collections.yard[0]?.record), checksum: 'abc' }];

		const result = dumpSchema.safeParse({ ...validDump, collections: { ...validDump.collections, yard: rows } });

		expect(result.success).toBe(false);
	});

	it('refuses an unknown key at the top level', () => {
		expect(dumpSchema.safeParse({ ...validDump, generatedBy: 'a helpful script' }).success).toBe(false);
	});

	it('refuses an unknown collection', () => {
		const collections = { ...validDump.collections, advisories: [] };

		expect(dumpSchema.safeParse({ ...validDump, collections }).success).toBe(false);
	});

	it('refuses a collection the payload left out', () => {
		const { plants: _plants, ...rest } = validDump.collections;

		expect(dumpSchema.safeParse({ ...validDump, collections: rest }).success).toBe(false);
	});
});

describe('envelopeSchema', () => {
	const wrappedTagPolicy = envelopeSchema(tagPolicySchema);

	// The mirror rule holds wherever the record carries an id. A TagPolicy does
	// not, so the factory has to let this through rather than treat a missing
	// id as a mismatch.
	it('files a record with no id of its own under the id it was given', () => {
		const result = wrappedTagPolicy.safeParse(envelope(TAG_POLICY_ID, { neverDelegableTags: [], safetyTags: [] }));

		expect(result.success).toBe(true);
	});

	it('refuses an envelope whose id does not mirror the record it wraps', () => {
		const rows = [envelope('brown-turkey-fig', validDump.collections.plants[0]?.record)];

		const result = dumpSchema.safeParse({ ...validDump, collections: { ...validDump.collections, plants: rows } });

		expect(result.success).toBe(false);
		expect(result.error?.issues.map(issue => issue.message)).toContain('id must mirror record.id');
	});
});

describe('parseDump', () => {
	it('throws one sentence naming the path that failed', () => {
		expect(() => parseDump({ ...validDump, version: 7 })).toThrow(/^dump: version .*\.$/);
	});
});
