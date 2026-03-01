const normalizeSpaces = (value: string) => value.replace(/\s+/g, ' ').trim()

export const normalizeEmail = (value: string) =>
  normalizeSpaces(value).normalize('NFKC').toLowerCase()

