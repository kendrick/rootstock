import type { z } from 'zod';

/**
 * Builds a parser from a Zod schema that throws a full-sentence `Error` instead of Zod's own
 * `ZodError`. The artifact this repo generates is read by a static site with no one watching the
 * build: when it fails to validate, the only trace is whatever the thrown message says. A raw
 * `ZodError` dump is unreadable in a CI log and useless in a rendered error state, so this composes
 * one sentence per issue naming the label, the failing path, Zod's own diagnosis, and the value
 * that actually arrived there.
 */
export function parseWith<T>(schema: z.ZodType<T>, label: string): (value: unknown) => T {
	return (value: unknown): T => {
		const result = schema.safeParse(value);
		if (result.success) {
			return result.data;
		}
		throw new Error(composeMessage(label, value, result.error));
	};
}

/**
 * Same message composition as `parseWith`, returned instead of thrown. The browser parses the
 * artifact on load and has to render an error state rather than crash the page, so it needs the
 * failure as a value it can put in JSX, not an exception it has to catch.
 */
export function safeParseWith<T>(
	schema: z.ZodType<T>,
	label: string,
): (value: unknown) => { ok: true; value: T } | { ok: false; error: string } {
	return (value: unknown) => {
		const result = schema.safeParse(value);
		if (result.success) {
			return { ok: true, value: result.data };
		}
		return { ok: false, error: composeMessage(label, value, result.error) };
	};
}

function composeMessage(label: string, value: unknown, error: z.ZodError): string {
	const sentences = error.issues.map(issue => describeIssue(value, issue));
	return `${label}: ${sentences.join(' ')}`;
}

// Zod's own `issue.message` already names what was expected (its default messages read like
// "Invalid input: expected string, received number"), but it does not carry the actual value that
// failed — that has to be recovered by walking the original input along the issue's own path.
function describeIssue(value: unknown, issue: z.core.$ZodIssue): string {
	const path = formatPath(issue.path);
	const received = describeValue(getAtPath(value, issue.path));
	return `${path} ${issue.message}, but received ${received}.`;
}

function formatPath(path: ReadonlyArray<PropertyKey>): string {
	if (path.length === 0) {
		return '(root)';
	}
	let out = '';
	for (const segment of path) {
		if (typeof segment === 'number') {
			out += `[${segment}]`;
		}
		else {
			out += out.length > 0 ? `.${String(segment)}` : String(segment);
		}
	}
	return out;
}

function getAtPath(value: unknown, path: ReadonlyArray<PropertyKey>): unknown {
	let current = value;
	for (const segment of path) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof segment === 'number') {
			if (!Array.isArray(current)) {
				return undefined;
			}
			current = current[segment];
		}
		else {
			if (typeof current !== 'object') {
				return undefined;
			}
			current = (current as Record<PropertyKey, unknown>)[segment];
		}
	}
	return current;
}

function describeValue(value: unknown): string {
	if (value === undefined) {
		return 'undefined';
	}
	if (typeof value === 'function') {
		return `a function named "${value.name || '(anonymous)'}"`;
	}
	if (typeof value === 'symbol') {
		return value.toString();
	}
	if (typeof value === 'bigint') {
		return `${value.toString()}n`;
	}
	try {
		return JSON.stringify(value);
	}
	catch {
		return String(value);
	}
}
