const getOrdinalSuffix = (day: number) => {
  const tens = day % 100
  if (tens >= 11 && tens <= 13) return "th"
  switch (day % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
  }
}

export function formatHumanReadableDate(value?: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const day = date.getDate()
  const suffix = getOrdinalSuffix(day)
  const month = date.toLocaleString("en-US", { month: "long" })
  const year = date.getFullYear()
  return `${day}${suffix} ${month} ${year}`
}
