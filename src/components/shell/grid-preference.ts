/**
 * Where the construction-grid preference lives, and the script that applies it
 * before first paint.
 *
 * Separate from the component that writes it so the storage contract has one
 * owner and the layout can import the script without pulling a client component
 * into a server file. A script reading one key while the toggle wrote another is
 * a bug nobody sees until a reader's choice quietly stops sticking.
 */
export const GRID_STORAGE_KEY = 'rootstock:grid';

/**
 * Runs from the document body, before anything paints.
 *
 * Without it a reader who switched the grid off gets a flash of the exact
 * pattern they switched off, on every navigation, which is worse than not
 * offering the control at all. Nothing else can do this job: the preference
 * lives in localStorage, and no server render can read it.
 *
 * Wrapped in try/catch because Safari throws on localStorage in private mode
 * rather than returning null, and an uncaught throw here would take the document
 * down before a single element rendered.
 */
export const GRID_PREFERENCE_SCRIPT = `try{if(localStorage.getItem('${GRID_STORAGE_KEY}')==='off'){document.body.dataset.grid='off'}}catch(e){}`;
