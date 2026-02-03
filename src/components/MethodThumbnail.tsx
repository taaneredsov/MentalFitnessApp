import { useState } from "react"
import { cn } from "@/lib/utils"

interface MethodThumbnailProps {
  photo?: string
  name: string
  className?: string
}

export function MethodThumbnail({ photo, name, className }: MethodThumbnailProps) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const showFallback = !photo || imgError

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Fallback - always rendered underneath */}
      <div className={`absolute inset-0 flex items-center justify-center bg-primary/10 p-2 ${showFallback ? 'opacity-100' : 'opacity-0'}`}>
        <img src="/pwa-512x512.svg" alt="" className="w-full h-full opacity-60" />
      </div>
      {/* Actual image */}
      {photo && !imgError && (
        <img
          src={photo}
          alt={name}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      )}
    </div>
  )
}
