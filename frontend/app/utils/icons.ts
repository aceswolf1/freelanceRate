/**
 * PrimeIcons need two classes: the base `pi` (sets the icon font) and the
 * glyph (`pi-calendar`). With only the glyph class the browser draws the
 * private-use code point in the text font, so it shows as an empty box.
 * Callers may pass either form; this always yields a renderable class string.
 */
export function iconClass(icon: string): string {
  const classes = icon.trim().split(/\s+/).filter(Boolean)
  return classes.includes('pi') ? classes.join(' ') : ['pi', ...classes].join(' ')
}
