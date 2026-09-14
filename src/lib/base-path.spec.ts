import { describe, expect, it } from 'vitest';
import { BASE_PATH, withBasePath } from './base-path';

describe('withBasePath', () => {
	it('prefixes a root-relative path with the deployed base path', () => {
		expect(withBasePath('/yard.jpg')).toBe(`${BASE_PATH}/yard.jpg`);
	});

	it('never returns the bare path the seed carries, since that 404s on the deployed site', () => {
		expect(withBasePath('/yard.jpg')).not.toBe('/yard.jpg');
	});
});
