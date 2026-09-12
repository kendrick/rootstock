import { describe, expect, it } from 'vitest';
import { readLocationFromEnv } from './location';

const validEnv = {
	ROOTSTOCK_LATITUDE: '35.2',
	ROOTSTOCK_LONGITUDE: '-97.4',
	ROOTSTOCK_TIME_ZONE: 'America/Chicago',
};

describe('readLocationFromEnv', () => {
	it('parses all three variables into a typed Location', () => {
		expect(readLocationFromEnv(validEnv)).toEqual({
			latitude: 35.2,
			longitude: -97.4,
			timeZone: 'America/Chicago',
		});
	});

	it('never reads process.env when an env object is supplied', () => {
		// Guards the whole point of the default-parameter shape: a location
		// resolved from a value other than the object passed in would mean
		// this spec was exercising the real environment.
		expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: '1' }).latitude).toBe(1);
	});

	describe('reading ROOTSTOCK_LATITUDE', () => {
		it('throws naming the variable when unset', () => {
			const { ROOTSTOCK_LATITUDE: _omit, ...env } = validEnv;
			expect(() => readLocationFromEnv(env)).toThrow(/ROOTSTOCK_LATITUDE is not set/);
		});

		it('throws when blank', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: '   ' }))
				.toThrow(/ROOTSTOCK_LATITUDE is not set/);
		});

		it('throws when non-numeric', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: 'north-ish' }))
				.toThrow(/ROOTSTOCK_LATITUDE is set to 'north-ish', which is not a number/);
		});

		it('throws when the literal string NaN', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: 'NaN' }))
				.toThrow(/ROOTSTOCK_LATITUDE is set to 'NaN', which is not a number/);
		});

		it('throws when outside -90..90', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: '95' }))
				.toThrow(/ROOTSTOCK_LATITUDE is set to 95, which is outside the valid range of -90 to 90/);
		});

		it('accepts the boundary values', () => {
			expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: '90' }).latitude).toBe(90);
			expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_LATITUDE: '-90' }).latitude).toBe(-90);
		});
	});

	describe('reading ROOTSTOCK_LONGITUDE', () => {
		it('throws naming the variable when unset', () => {
			const { ROOTSTOCK_LONGITUDE: _omit, ...env } = validEnv;
			expect(() => readLocationFromEnv(env)).toThrow(/ROOTSTOCK_LONGITUDE is not set/);
		});

		it('throws when non-numeric', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_LONGITUDE: 'east-ish' }))
				.toThrow(/ROOTSTOCK_LONGITUDE is set to 'east-ish', which is not a number/);
		});

		it('throws when outside -180..180', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_LONGITUDE: '200' }))
				.toThrow(/ROOTSTOCK_LONGITUDE is set to 200, which is outside the valid range of -180 to 180/);
		});

		it('accepts the boundary values', () => {
			expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_LONGITUDE: '180' }).longitude).toBe(180);
			expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_LONGITUDE: '-180' }).longitude).toBe(-180);
		});
	});

	describe('reading ROOTSTOCK_TIME_ZONE', () => {
		it('throws naming the variable when unset', () => {
			const { ROOTSTOCK_TIME_ZONE: _omit, ...env } = validEnv;
			expect(() => readLocationFromEnv(env)).toThrow(/ROOTSTOCK_TIME_ZONE is not set/);
		});

		it('throws when blank', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_TIME_ZONE: '  ' }))
				.toThrow(/ROOTSTOCK_TIME_ZONE is not set/);
		});

		it('throws when not a recognized IANA zone', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_TIME_ZONE: 'America/Chigaco' }))
				.toThrow(/ROOTSTOCK_TIME_ZONE is set to 'America\/Chigaco', which is not a recognized IANA time zone/);
		});

		it('throws on a US-style abbreviation rather than accepting it as a zone', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_TIME_ZONE: 'CST' }))
				.toThrow(/ROOTSTOCK_TIME_ZONE is set to 'CST', which is not a recognized IANA time zone/);
		});

		it('accepts UTC and a zone with no fixed offset word in it', () => {
			expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_TIME_ZONE: 'UTC' }).timeZone).toBe('UTC');
			expect(readLocationFromEnv({ ...validEnv, ROOTSTOCK_TIME_ZONE: 'Pacific/Auckland' }).timeZone).toBe('Pacific/Auckland');
		});
	});

	describe('ordering', () => {
		it('names latitude first when both latitude and longitude are missing', () => {
			const { ROOTSTOCK_LATITUDE: _lat, ROOTSTOCK_LONGITUDE: _lon, ...env } = validEnv;
			expect(() => readLocationFromEnv(env)).toThrow(/ROOTSTOCK_LATITUDE is not set/);
		});

		it('names longitude first when longitude and time zone are both wrong but latitude is fine', () => {
			expect(() => readLocationFromEnv({
				...validEnv,
				ROOTSTOCK_LONGITUDE: 'bad',
				ROOTSTOCK_TIME_ZONE: 'not-a-zone',
			})).toThrow(/ROOTSTOCK_LONGITUDE is set to 'bad', which is not a number/);
		});

		it('reaches time zone only once latitude and longitude are both valid', () => {
			expect(() => readLocationFromEnv({ ...validEnv, ROOTSTOCK_TIME_ZONE: 'not-a-zone' }))
				.toThrow(/ROOTSTOCK_TIME_ZONE is set to 'not-a-zone'/);
		});
	});
});
