import type { Rule } from '@/rules/rule';
import { seedRules } from '@/seed';

/**
 * Look up a seed rule by id. Throws at module load time if the seed no longer
 * carries it, so a rename in `src/seed/rules.json` fails loudly here rather
 * than silently producing `undefined` inside a test assertion.
 */
function findSeedRule(id: string): Rule {
	const rule = seedRules.find(candidate => candidate.id === id);
	if (rule === undefined) {
		throw new Error(`seedRules has no rule '${id}': rules fixtures expect the seed to still carry it`);
	}
	return rule;
}

/**
 * A window rule backed by an extension source. Also carries the `chemical` tag
 * and a productLabel, so it doubles as the canonical chemical rule for specs
 * that care about label rendering.
 */
export const windowRule: Rule = { ...findSeedRule('fall-pre-emergent') };

/**
 * The spring pre-emergent threshold rule. This is the one seed rule that ships
 * with a published range (`published.low` / `published.high`) alongside the
 * single value the yard acts on—making it the right fixture for any spec that
 * exercises the range display path.
 */
export const thresholdRule: Rule = { ...findSeedRule('spring-pre-emergent') };

/**
 * A cadence rule backed by an owner source. `spring-pre-emergent-follow-up`
 * also carries an `after` link, which lets specs exercise the chained-cadence
 * display path without inventing a fixture.
 */
export const cadenceRule: Rule = { ...findSeedRule('spring-pre-emergent-follow-up') };

/**
 * A guard rule with a `defer` effect, backed by an owner source. The fig
 * fertilizer guard has a `within-window` condition with `negate: true`, so it
 * covers the "not until" variant of the condition shape.
 */
export const guardRule: Rule = { ...findSeedRule('fig-fertilizer-until-spring') };

/**
 * Aliases for specs that describe what they care about rather than which seed
 * rule has the property.
 */
export const extensionSourceRule: Rule = windowRule;
export const ownerSourceRule: Rule = cadenceRule;

/**
 * A rule tagged `chemical` with a non-null `productLabel`. `fall-pre-emergent`
 * satisfies both requirements and is already the window fixture, so this alias
 * keeps test authors from having to know which one the property lives on.
 */
export const chemicalRule: Rule = windowRule;

/**
 * The threshold rule that ships with a published extension range. Aliased from
 * `thresholdRule` so specs can import the name that describes the case rather
 * than reconstructing the knowledge that spring-pre-emergent is the one with
 * the range.
 */
export const thresholdWithPublishedRange: Rule = thresholdRule;

/**
 * A cadence rule with `delegable: true` and no chemical tag, so `isDelegable`
 * returns `true` for it. The other four rules in this file all have
 * `delegable: false`—specs that need both outcomes in one render use this
 * alongside one of the non-delegable fixtures.
 */
export const delegableRule: Rule = { ...findSeedRule('esperanza-feeding') };

/**
 * One rule of each kind, in kind order, for specs that need a representative
 * set without caring which specific rule fills each slot. Includes one
 * delegable rule (`delegableRule`) so specs asserting on the delegable badge
 * can see both "Delegable" and "Not delegable" in a single render.
 */
export const allFixtureRules: Rule[] = [windowRule, thresholdRule, cadenceRule, guardRule, delegableRule];
