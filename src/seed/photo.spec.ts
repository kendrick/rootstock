import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isStartOfFrame, jpegSegments, readFrameDimensions } from './photo';

const APP1_MARKER = 0xE1;
const SOI_MARKER = 0xD8;
const SOF0_MARKER = 0xC0;

/**
 * A minimal but structurally real JPEG: SOI, an APP1 carrying a fake Exif
 * blob, an SOF0 naming a frame, then EOI. Built by hand rather than lifted
 * from a fixture file, because the whole point of this test is proving the
 * walk finds a marker on bytes nobody could have hand-tuned to pass.
 */
function jpegWithApp1(width: number, height: number): Uint8Array {
	const exifPayload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
	const app1Length = exifPayload.length + 2;
	const sofPayload = [
		0x08, // precision
		(height >> 8) & 0xFF,
		height & 0xFF,
		(width >> 8) & 0xFF,
		width & 0xFF,
		0x01, // one component, enough to make the segment well-formed
		0x01,
		0x11,
		0x00,
	];
	const sofLength = sofPayload.length + 2;

	return Uint8Array.from([
		0xFF,
		SOI_MARKER,
		0xFF,
		APP1_MARKER,
		(app1Length >> 8) & 0xFF,
		app1Length & 0xFF,
		...exifPayload,
		0xFF,
		SOF0_MARKER,
		(sofLength >> 8) & 0xFF,
		sofLength & 0xFF,
		...sofPayload,
		0xFF,
		0xD9, // EOI
	]);
}

describe('jpegSegments', () => {
	// A check that cannot fail is worse than no check: this proves the walk
	// actually finds an APP1 segment when one is present, on bytes this test
	// controls, before the next test trusts it to find none on a real file.
	it('finds the APP1 segment in a JPEG that carries one', () => {
		const bytes = jpegWithApp1(100, 50);

		const segments = jpegSegments(bytes);

		expect(segments.some(s => s.marker === APP1_MARKER)).toBe(true);
	});

	it('reads the frame dimensions out of the SOF segment', () => {
		const bytes = jpegWithApp1(4096, 3072);

		const sof = jpegSegments(bytes).find(s => isStartOfFrame(s.marker));

		expect(sof).toBeDefined();
		expect(readFrameDimensions(bytes, sof!)).toEqual({ width: 4096, height: 3072 });
	});
});

describe('the committed seed photo', () => {
	// ADR 0004: EXIF (and XMP, which rides in the same segment) is stripped on
	// the way in and the result is asserted rather than assumed. ImageMagick
	// reporting that -strip ran is not evidence; a marker walk over the bytes
	// that were actually committed is.
	const path = join(import.meta.dirname, '..', '..', 'public', 'yard.jpg');
	const bytes = readFileSync(path);
	const segments = jpegSegments(bytes);

	it('carries no APP1 segment', () => {
		expect(segments.filter(s => s.marker === APP1_MARKER)).toEqual([]);
	});

	it('keeps its long edge at or under 2400px', () => {
		const sof = segments.find(s => isStartOfFrame(s.marker));
		expect(sof, 'expected a SOF segment to be present').toBeDefined();

		const { width, height } = readFrameDimensions(bytes, sof!);

		expect(Math.max(width, height)).toBeLessThanOrEqual(2400);
	});

	// Only an upper bound. The photo is the heaviest thing the site serves and
	// the Away Card gets read on a phone in a yard, so the ceiling is the part
	// worth defending; a future encode that comes in smaller is a win, not a
	// regression to fail the build over.
	it('stays under 2 MB', () => {
		const { size } = statSync(path);

		expect(size).toBeLessThanOrEqual(2_000_000);
	});
});
