import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';

/**
 * What a route renders instead of itself when the committed Artifact or its
 * status record fails to validate.
 *
 * The failure sentence goes on the page, because nobody is watching this build.
 * The daily run commits `data/artifact.json` and the site reads it, so the first
 * person to learn that a field is wrong is a reader standing in the yard. The
 * sentence `parse.ts` composes names the failing path and the value that
 * arrived, which is how that reader tells a hand-edit from a bad generation run.
 * One wrong field reads differently from a dozen.
 */
export function ArtifactError({ message }: { message: string }): ReactElement {
	return (
		<section role="alert" className="mx-auto max-w-3xl px-4 py-12">
			{/*
			 * The page's only h1. The gate renders this in place of the route's
			 * content rather than around it, and the shell header is deliberately
			 * not a heading, so nothing else on the page competes for the level.
			 */}
			<h1 className="font-display text-display leading-none font-extrabold tracking-tight text-foreground uppercase">
				This week&rsquo;s Plan cannot be shown
			</h1>

			<p className="mt-3 text-muted-foreground">
				The committed Artifact did not match its schema. Showing the parts that did
				parse would hand you a Task with nothing behind it, and every Task here
				carries a Citation you can check.
			</p>

			<div className="mt-6 rounded-md border border-border p-4">
				{/*
				 * The marker is a filled badge rather than red text. This theme's
				 * --destructive is red-900 against a zinc-950 page, which passes
				 * contrast as a background under zinc-50 and fails it as text.
				 */}
				<Badge variant="destructive">Validation failed</Badge>
				<p className="mt-3 font-mono text-evidence break-words text-foreground">{message}</p>
			</div>

			<p className="mt-6 text-muted-foreground">
				Check the named field in
				{' '}
				<code className="font-mono">data/artifact.json</code>
				{' '}
				or
				{' '}
				<code className="font-mono">data/status.json</code>
				{' '}
				against
				{' '}
				<code className="font-mono">schemas/</code>
				, then re-run the generation to rewrite the file.
			</p>
		</section>
	);
}
