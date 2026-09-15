/**
 * Where the orientation band's dismissal is kept, and the script that applies it
 * before first paint.
 *
 * Separate from the component that writes it so the storage contract has one
 * owner, and so the layout can import the script without pulling a client
 * component into a server file.
 */
export const ORIENTED_STORAGE_KEY = 'rootstock:oriented';

/**
 * Runs before anything paints, so a reader who dismissed the band never sees it
 * flash back on the next navigation.
 *
 * Wrapped in try/catch because Safari throws on localStorage in private mode
 * rather than returning null, and an uncaught throw here would take the document
 * down before a single element rendered.
 */
export const ORIENTED_SCRIPT = `try{if(localStorage.getItem('${ORIENTED_STORAGE_KEY}')==='1'){document.body.dataset.oriented='1'}}catch(e){}`;
