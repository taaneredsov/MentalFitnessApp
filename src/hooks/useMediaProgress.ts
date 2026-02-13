import { useState, useRef, useCallback, useEffect } from "react"

interface UseMediaProgressOptions {
  pauseThreshold?: number // Threshold for pause trigger (0-1), default 0.97 (97%)
  onComplete?: () => void
}

interface UseMediaProgressReturn {
  completed: boolean
  progress: number
  handleTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => void
  handleEnded: () => void
  handlePause: (e: React.SyntheticEvent<HTMLMediaElement>) => void
  reset: () => void
}

/**
 * Hook to track media playback progress and detect completion
 *
 * Triggers completion when:
 * - Media ends (100% played)
 * - User pauses after reaching pauseThreshold (default 97%)
 *
 * @param mediaId - Unique identifier for the media being tracked
 * @param options - Configuration options
 * @returns Progress tracking state and event handlers
 */
export function useMediaProgress(
  mediaId: string,
  options: UseMediaProgressOptions = {}
): UseMediaProgressReturn {
  const { pauseThreshold = 0.97, onComplete } = options

  const [completed, setCompleted] = useState(false)
  const [progress, setProgress] = useState(0)
  const hasTriggered = useRef(false)
  const mediaIdRef = useRef(mediaId)

  // Reset if mediaId changes
  useEffect(() => {
    mediaIdRef.current = mediaId
    hasTriggered.current = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting progress when media changes
    setCompleted(false)
    setProgress(0)
  }, [mediaId])

  const triggerComplete = useCallback(() => {
    if (!hasTriggered.current) {
      hasTriggered.current = true
      setCompleted(true)
      onComplete?.()
    }
  }, [onComplete])

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = e.currentTarget
      if (!media.duration || isNaN(media.duration)) return

      const currentProgress = media.currentTime / media.duration
      setProgress(currentProgress)
    },
    []
  )

  const handleEnded = useCallback(() => {
    // Trigger completion when media ends (100%)
    triggerComplete()
  }, [triggerComplete])

  const handlePause = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const media = e.currentTarget
      if (!media.duration || isNaN(media.duration)) return

      const currentProgress = media.currentTime / media.duration

      // Trigger completion when paused at threshold (default 97%) or more
      if (currentProgress >= pauseThreshold) {
        triggerComplete()
      }
    },
    [pauseThreshold, triggerComplete]
  )

  const reset = useCallback(() => {
    hasTriggered.current = false
    setCompleted(false)
    setProgress(0)
  }, [])

  return {
    completed,
    progress,
    handleTimeUpdate,
    handleEnded,
    handlePause,
    reset
  }
}
