//"3 items" / "1 item" — pick singular or plural by count. one home for
//pluralized counts so copy stays identical everywhere it shows up.
export function formatCount(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`
}
