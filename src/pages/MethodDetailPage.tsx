import { useState, useCallback } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useAuth } from "@/contexts/AuthContext"
import { useMethod } from "@/hooks/queries"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FeedbackModal } from "@/components/FeedbackModal"
import { useMediaProgress } from "@/hooks/useMediaProgress"
import type { MediaItem } from "@/types/program"
import { Loader2, ArrowLeft, Clock, Volume2, Video, CheckCircle } from "lucide-react"

interface MediaPlayerProps {
  media: MediaItem
  onComplete: (mediaId: string) => void
  isCompleted: boolean
}

function MediaPlayer({ media, onComplete, isCompleted }: MediaPlayerProps) {
  const { handleTimeUpdate, handleEnded, handlePause } = useMediaProgress(media.id, {
    pauseThreshold: 0.97,  // Trigger on pause at 97%+
    onComplete: () => onComplete(media.id)
  })

  const typeLC = (media.type || "").toLowerCase()
  const isAudio = typeLC.includes("audio")
  const isVideo = typeLC.includes("video")

  // If no recognized type but has URL, try to detect from URL
  const urlLC = (media.url || "").toLowerCase()
  const isAudioByUrl = urlLC.includes(".mp3") || urlLC.includes(".wav") || urlLC.includes(".m4a") || urlLC.includes(".ogg")
  const isVideoByUrl = urlLC.includes(".mp4") || urlLC.includes(".webm") || urlLC.includes(".mov")

  if ((isAudio || isAudioByUrl) && media.url) {
    return (
      <Card className={isCompleted ? "ring-2 ring-green-500" : ""}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            {isCompleted ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <Volume2 className="h-5 w-5 text-primary" />
            )}
            <span className="text-sm font-medium">{media.filename}</span>
            {isCompleted && (
              <span className="text-xs text-green-600 ml-auto">Afgerond</span>
            )}
          </div>
          <audio
            controls
            className="w-full"
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPause={handlePause}
          >
            <source src={media.url} />
            Je browser ondersteunt geen audio playback.
          </audio>
        </CardContent>
      </Card>
    )
  }

  if ((isVideo || isVideoByUrl) && media.url) {
    return (
      <Card className={`overflow-hidden ${isCompleted ? "ring-2 ring-green-500" : ""}`}>
        <CardContent className="p-0">
          <video
            controls
            className="w-full aspect-video"
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onPause={handlePause}
          >
            <source src={media.url} />
            Je browser ondersteunt geen video playback.
          </video>
          <div className="p-3 flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle className="h-4 w-4 text-green-500" />
            ) : (
              <Video className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm text-muted-foreground">{media.filename}</span>
            {isCompleted && (
              <span className="text-xs text-green-600 ml-auto">Afgerond</span>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Fallback for unknown media types
  return (
    <Card>
      <CardContent className="p-4">
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {media.filename}
        </a>
      </CardContent>
    </Card>
  )
}

interface LocationState {
  programId?: string  // DEPRECATED - use programmaplanningId
  programmaplanningId?: string  // Link to specific scheduled session
}

export function MethodDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, accessToken } = useAuth()
  const queryClient = useQueryClient()

  // Get programmaplanningId from navigation state (when coming from a program schedule)
  const locationState = location.state as LocationState
  const programmaplanningId = locationState?.programmaplanningId
  const programId = locationState?.programId  // Fallback for backward compatibility

  // Use React Query for method data (cached)
  const { data: method, isLoading, error: methodError } = useMethod(id || "")
  const error = methodError ? "Kon methode niet laden" : null

  const [completedMediaIds, setCompletedMediaIds] = useState<Set<string>>(new Set())
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const handleMediaComplete = useCallback((mediaId: string) => {
    setCompletedMediaIds(prev => {
      if (prev.has(mediaId)) return prev

      const updated = new Set(prev)
      updated.add(mediaId)

      // Show feedback modal on first completion (if not already shown)
      if (prev.size === 0 && !feedbackSubmitted) {
        setShowFeedback(true)
      }

      return updated
    })
  }, [feedbackSubmitted])

  const handleSubmitFeedback = async (remark: string) => {
    if (!user?.id || !method?.id || !accessToken) {
      console.error("Missing required data:", { userId: user?.id, methodId: method?.id, hasToken: !!accessToken })
      setShowFeedback(false)
      return
    }

    try {
      console.log("Creating method usage:", { userId: user.id, methodId: method.id, programmaplanningId, programId, remark })
      const result = await api.methodUsage.create(
        {
          userId: user.id,
          methodId: method.id,
          programmaplanningId: programmaplanningId || undefined,
          programId: !programmaplanningId ? programId || undefined : undefined,  // Only use programId as fallback
          remark: remark || undefined
        },
        accessToken
      )
      console.log("Method usage created:", result)

      // Invalidate queries so homepage shows updated progress
      if (programId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.methodUsage(programId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.program(programId) })
      }
      queryClient.invalidateQueries({ queryKey: ["programs"] })

      setFeedbackSubmitted(true)
      setShowFeedback(false)
    } catch (err) {
      console.error("Failed to save feedback:", err)
      // Still close the modal even on error
      setShowFeedback(false)
    }
  }

  const handleSkipFeedback = async () => {
    if (!user?.id || !method?.id || !accessToken) {
      console.error("Missing required data:", { userId: user?.id, methodId: method?.id, hasToken: !!accessToken })
      setShowFeedback(false)
      return
    }

    try {
      console.log("Creating method usage (skip):", { userId: user.id, methodId: method.id, programmaplanningId, programId })
      const result = await api.methodUsage.create(
        {
          userId: user.id,
          methodId: method.id,
          programmaplanningId: programmaplanningId || undefined,
          programId: !programmaplanningId ? programId || undefined : undefined  // Only use programId as fallback
        },
        accessToken
      )
      console.log("Method usage created:", result)

      // Invalidate queries so homepage shows updated progress
      if (programId) {
        queryClient.invalidateQueries({ queryKey: queryKeys.methodUsage(programId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.program(programId) })
      }
      queryClient.invalidateQueries({ queryKey: ["programs"] })

      setFeedbackSubmitted(true)
    } catch (err) {
      console.error("Failed to save usage:", err)
    }
    setShowFeedback(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !method) {
    return (
      <div className="px-4 py-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Terug
        </Button>
        <p className="text-destructive">{error || "Methode niet gevonden"}</p>
      </div>
    )
  }

  const hasMedia = method.mediaDetails && method.mediaDetails.length > 0

  return (
    <div className="px-4 py-6 space-y-6">
      <Button variant="ghost" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Terug
      </Button>

      {/* Title */}
      <h1 className="text-2xl font-bold">{method.name}</h1>

      {/* Duration */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>{method.duration} minuten</span>
      </div>

      {/* Description */}
      {method.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Beschrijving</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">
              {method.description}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Media */}
      {hasMedia && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Media</h2>
          <div className="space-y-3">
            {method.mediaDetails!.map((item) => (
              <MediaPlayer
                key={item.id}
                media={item}
                onComplete={handleMediaComplete}
                isCompleted={completedMediaIds.has(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={showFeedback}
        methodName={method.name}
        onSubmit={handleSubmitFeedback}
        onSkip={handleSkipFeedback}
      />
    </div>
  )
}
