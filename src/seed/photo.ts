/**
 * A JPEG segment, as found by walking the file rather than trusting whatever
 * a tool reported.
 *
 * For a segment that carries a payload, `offset` points at its length word,
 * so a caller reading the payload knows where it starts. A marker with no
 * payload has no length word to point at, so `offset` is the marker byte
 * itself and `length` is 0. Callers that read a payload must therefore check
 * `length` first rather than assuming every segment has one.
 */
export interface JpegSegment {
	marker: number;
	offset: number;
	length: number;
}

const SOI = 0xD8;
const EOI = 0xD9;
const SOS = 0xDA;

// The thirteen Start Of Frame markers: the C0-CF span minus 0xC4, 0xC8 and
// 0xCC, which name DHT, a reserved marker, and DAC. None of those three carry
// a frame header, so treating the whole span as SOF would read dimensions out
// of the wrong segment.
const SOF_MARKERS = new Set([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF]);

export function isStartOfFrame(marker: number): boolean {
	return SOF_MARKERS.has(marker);
}

// The markers that carry no length word, so a length-prefixed walk has
// nothing to measure and must recognize them by number: TEM (0x01), and the
// eight restart markers RST0 through RST7 (0xD0-0xD7) that punctuate
// entropy-coded scan data.
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
 * Walks a JPEG buffer marker by marker and returns the header segments, up to
 * and including SOS. Everything past SOS is entropy-coded scan data with no
 * length words to walk, and everything worth asserting about a stripped file
 * (APP1, SOF) sits before it. This exists so ADR 0004 (coordinates never enter the repository) has evidence
 * independent of the tool that stripped the file: ImageMagick reporting
 * `-strip` ran is not proof the output is clean, only a real walk of the
 * resulting bytes is. Takes no dependency for the same reason—a library's
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
 * interpreting one. `index.spec.ts` checks these dimensions against
 * `yard.json`, and it reads them through here so both sides of that check
 * share one decode rather than two that can diverge.
 */
export function readFrameDimensions(bytes: Uint8Array, segment: JpegSegment): FrameDimensions {
	if (!isStartOfFrame(segment.marker)) {
		throw new Error(`segment at offset ${segment.offset} is marker 0x${segment.marker.toString(16)}, not a SOF`);
	}
	// Payload after the two length bytes: 1 byte precision, then height and
	// width as big-endian u16s, in that order—JPEG writes height first.
	const payload = segment.offset + 2;
	const height = (byteAt(bytes, payload + 1) << 8) + byteAt(bytes, payload + 2);
	const width = (byteAt(bytes, payload + 3) << 8) + byteAt(bytes, payload + 4);
	return { width, height };
}
