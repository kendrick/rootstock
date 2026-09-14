import { describe, expect, it } from 'vitest';
import { formatValue } from './series-text';

describe('formatValue', () => {
	it('formats Fahrenheit with a degree symbol and no space', () => {
		expect(formatValue(72, 'F')).toBe('72°F');
	});

	it('formats millimeters with a leading space', () => {
		expect(formatValue(5, 'mm')).toBe('5 mm');
	});

	it('formats percent with no space', () => {
		expect(formatValue(40, 'percent')).toBe('40%');
	});
});
