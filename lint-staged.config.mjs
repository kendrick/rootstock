/** @type {import('lint-staged').Configuration} */
export default {
	// eslint_d, not eslint: the antfu preset takes ~3s to load its plugins, and a
	// fresh eslint process paid that on every commit before linting a single file.
	// The daemon loads the config once and keeps it, and it does pick up edits to
	// eslint.config.mjs on its own. It exits after 15 idle minutes, so the first
	// commit after a break still pays the old price; every one after that is fast.
	'*.{js,mjs,cjs,ts,tsx,jsx}': ['eslint_d --fix'],
	'*.{json,md,mdx,yaml,yml}': ['eslint_d --fix'],
	'*.{css,scss,postcss}': ['stylelint --fix'],
};
