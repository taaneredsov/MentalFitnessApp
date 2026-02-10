export function calculateNextStreak(input: {
  lastActiveDate: string | null
  currentStreak: number
  longestStreak: number
  today: string
}): { currentStreak: number; longestStreak: number } {
  const { lastActiveDate, currentStreak, longestStreak, today } = input

  if (lastActiveDate === today) {
    return { currentStreak, longestStreak }
  }

  let nextCurrent = currentStreak
  let nextLongest = longestStreak

  if (!lastActiveDate) {
    nextCurrent = 1
  } else {
    const last = new Date(lastActiveDate)
    const now = new Date(today)
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 1) {
      nextCurrent += 1
    } else if (diffDays > 1) {
      nextCurrent = 1
    }
  }

  if (nextCurrent > nextLongest) {
    nextLongest = nextCurrent
  }

  return {
    currentStreak: nextCurrent,
    longestStreak: nextLongest
  }
}

