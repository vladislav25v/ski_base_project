export const parseNewsId = (rawId: string | undefined) => {
  if (!rawId) {
    return null
  }
  const parsed = Number(rawId)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }
  return parsed
}
