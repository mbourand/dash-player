function parseDuration(duration: string): number {
  const match = duration.match(
    /^P(?:(\d+\.?\d*)Y)?(?:(\d+\.?\d*)M)?(?:(\d+\.?\d*)D)?(?:T(?:(\d+\.?\d*)H)?(?:(\d+\.?\d*)M)?(?:(\d+\.?\d*)S)?)?$/
  )
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`)
  }

  const years = parseFloat(match[1]) || 0
  const months = parseFloat(match[2]) || 0
  const days = parseFloat(match[3]) || 0
  const hours = parseFloat(match[4]) || 0
  const minutes = parseFloat(match[5]) || 0
  const seconds = parseFloat(match[6]) || 0

  return (
    years * 3600 * 24 * 30 * 365 + months * 3600 * 24 * 30 + days * 3600 * 24 + hours * 3600 + minutes * 60 + seconds
  )
}

export const iso8601 = {
  parseDuration,
}
