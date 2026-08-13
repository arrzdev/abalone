/** Joins class names, dropping falsy entries. */
export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}
