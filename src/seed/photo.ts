/**
 * A JPEG segment, as found by walking the file rather than trusting whatever
 * a tool reported. `offset` and `length` point at the segment's own length
 * word, not the marker bytes before it, so a caller that wants to read the
 * payload knows exactly where it starts.
 */
export interface JpegSegment {
	marker: number;
	offset: number;
	length: number;
}

const SOI = 0xD8;
const EOI = 0xD9;
const SOS = 0xDA;

// The eleven Start Of Frame markers, minus 0xC4/0xC8/0xCC: those three numbers
// fall inside the C0-CF span but name DHT, a reserved marker, and DAC, none of
// which carry a frame header, so treating the whole span as SOF would read
// dimensions out of the wrong segment.
const SOF_MARKERS = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]);

export function isStartOfFrame(marker: number): boolean {
	return SOF_MARKERS.has(marker);
}

// A marker with no length word: the two RST bytes bracket entropy-coded data
// that a length-prefixed walk cannot skip over, so these must be recognized
// by number rather than measured.
function hasNoPayload(marker: number): boolean {
	return marker === 0x01 || (marker >= 0xD0 && marker <= 0xD7);
}

// `noUncheckedIndexedAccess` makes every `bytes[i]` read `number | undefined`,
// which is the correct type for an index a truncated or malformed file can
// put out of range. This is the one place that turns "undefined" into a
// thrown error instead of letting arithmetic silently produce NaN.
function byteAt(bytes: Uint8Array, index: number): number {
	const value = bytes[index];
	if (value === undefined) {
		throw new Error(`unexpected end of file at offset ${index}`);
	}
	return value;
}

/**
 * Walks a JPEG buffer marker by marker and returns every segment found. This
 * exists so ADR 0004 (coordinates never enter the repository) has evidence
 * independent of the tool that stripped the file: ImageMagick reporting
 * `-strip` ran is not proof the output is clean, only a real walk of the
 * resulting bytes is. Takes no dependency for the same reason — a library's
 * own parser is exactly the kind of untested claim this is meant to replace.
 */
export function jpegSegments(bytes: Uint8Array): JpegSegment[] {
	if (bytes.length < 2 || bytes[0] !== 0xFF || bytes[1] !== SOI) {
		throw new Error('not a JPEG: missing SOI marker at offset 0');
	}

	const segments: JpegSegment[] = [];
	let i = 2;

	while (i < bytes.length) {
		const first = byteAt(bytes, i);
		if (first !== 0xFF) {
			throw new Error(`expected a marker at offset ${i}, found byte 0x${first.toString(16)}`);
		}
		// Markers may be padded with extra 0xFF fill bytes; skip past them to
		// the byte that actually names the marker.
		let markerOffset = i + 1;
		while (byteAt(bytes, markerOffset) === 0xFF) {
			markerOffset += 1;
		}
		const marker = byteAt(bytes, markerOffset);

		if (marker === EOI) {
			segments.push({ marker, offset: markerOffset, length: 0 });
			break;
		}

		if (hasNoPayload(marker)) {
			segments.push({ marker, offset: markerOffset, length: 0 });
			i = markerOffset + 1;
			continue;
		}

		const length = (byteAt(bytes, markerOffset + 1) << 8) + byteAt(bytes, markerOffset + 2);
		segments.push({ marker, offset: markerOffset + 1, length });

		// SOS hands off to entropy-coded scan data with no length word of its
		// own, so this walk has nowhere left to jump to. Everything worth
		// asserting (APP1, SOF) lives in the header segments before it.
		if (marker === SOS) {
			break;
		}

		i = markerOffset + 1 + length;
	}

	return segments;
}

export interface FrameDimensions {
	width: number;
	height: number;
}

/**
 * Reads width and height out of a SOF segment found by `jpegSegments`. Split
 * out from the walk itself because the walk's job is finding segments, not
 * interpreting one — wave 1 cross-checks these against the committed seed
 * data, and it should be reading the same decode this spec asserts against
 * rather than a second, possibly-diverging one.
 */
export function readFrameDimensions(bytes: Uint8Array, segment: JpegSegment): FrameDimensions {
	if (!isStartOfFrame(segment.marker)) {
		throw new Error(`segment at offset ${segment.offset} is marker 0x${segment.marker.toString(16)}, not a SOF`);
	}
	// Payload after the two length bytes: 1 byte precision, then height and
	// width as big-endian u16s, in that order — JPEG writes height first.
	const payload = segment.offset + 2;
	const height = (byteAt(bytes, payload + 1) << 8) + byteAt(bytes, payload + 2);
	const width = (byteAt(bytes, payload + 3) << 8) + byteAt(bytes, payload + 4);
	return { width, height };
}
