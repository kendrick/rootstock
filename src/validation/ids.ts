import { z } from 'zod';

/**
 * The character class for a lowercase-kebab id, exported as a string rather than a compiled `RegExp`. `taskIdSchema` in `src/planner/task.ts` has to splice this class into a second, longer shape (`@`-joining two kebab ids), and a `RegExp` cannot be spliced into another pattern the way a string can be interpolated with `new RegExp()`.
 */
export const KEBAB_ID_PATTERN = '[a-z0-9-]+';

/** A lowercase-kebab identifier: a Rule id, a Plant id, an Occurrence id, a Guard id. A Task's own id is the `@`-joined shape `taskIdSchema` builds out of `KEBAB_ID_PATTERN`, so it composes this pattern rather than reusing this schema. */
export const kebabIdSchema = z.string().regex(new RegExp(`^${KEBAB_ID_PATTERN}$`));
