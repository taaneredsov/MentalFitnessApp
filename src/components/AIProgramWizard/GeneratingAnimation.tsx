import { useEffect, useState } from "react"
import { Brain, Sparkles, Target, Calendar } from "lucide-react"
import { LOADING_MESSAGES } from "./types"

export function GeneratingAnimation() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      {/* Animated brain with orbiting icons */}
      <div className="relative w-32 h-32">
        {/* Central brain icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
            <Brain className="w-10 h-10 text-primary" />
          </div>
        </div>

        {/* Orbiting Sparkles */}
        <div
          className="absolute w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center"
          style={{
            animation: "orbit 4s linear infinite",
            top: "0%",
            left: "50%",
            transform: "translateX(-50%)"
          }}
        >
          <Sparkles className="w-4 h-4 text-yellow-600" />
        </div>

        {/* Orbiting Target */}
        <div
          className="absolute w-8 h-8 rounded-full bg-green-100 flex items-center justify-center"
          style={{
            animation: "orbit 4s linear infinite",
            animationDelay: "-1.33s",
            top: "0%",
            left: "50%",
            transform: "translateX(-50%)"
          }}
        >
          <Target className="w-4 h-4 text-green-600" />
        </div>

        {/* Orbiting Calendar */}
        <div
          className="absolute w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"
          style={{
            animation: "orbit 4s linear infinite",
            animationDelay: "-2.66s",
            top: "0%",
            left: "50%",
            transform: "translateX(-50%)"
          }}
        >
          <Calendar className="w-4 h-4 text-blue-600" />
        </div>
      </div>

      {/* Main message */}
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          We zijn bezig uw mentale fitness programma samen te stellen
        </h3>
        <p className="text-sm text-muted-foreground h-5 transition-opacity duration-300">
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ animation: "progress 12s ease-in-out infinite" }}
        />
      </div>
    </div>
  )
}
