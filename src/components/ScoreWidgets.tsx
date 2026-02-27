import { useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { useUserRewards } from "@/hooks/queries"
import { Brain, Target, Heart, Loader2, AlertTriangle, RotateCcw } from "lucide-react"
import { toast } from "sonner"

interface ScoreCardProps {
  title: string
  score: number
  icon: React.ReactNode
  color: string
}

function ScoreCard({ title, score, icon, color }: ScoreCardProps) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col items-center gap-2">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div className="text-center min-w-0 w-full">
            <p className="text-[10px] text-muted-foreground truncate">{title}</p>
            <p className="text-lg font-bold">{score}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ScoreWidgets() {
  const { data: rewards, isLoading } = useUserRewards()
  const resetToastShown = useRef(false)

  // Show a one-time toast when streak was reset due to inactivity
  useEffect(() => {
    if (rewards?.streakReset && !resetToastShown.current) {
      resetToastShown.current = true
      toast.info("Je streak is gereset na 3 maanden inactiviteit. Je scores en badges blijven behouden!", {
        duration: 8000
      })
    }
  }, [rewards?.streakReset])

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <Card key={i}>
            <CardContent className="p-3 flex items-center justify-center h-[88px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!rewards) return null

  return (
    <div className="space-y-3">
      {/* Inactivity warning banner */}
      {rewards.inactivityWarning && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
          <CardContent className="p-3 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                Je bent al {rewards.inactivityWarning.daysInactive} dagen inactief
              </p>
              <p className="text-amber-700 dark:text-amber-400 mt-0.5">
                Na {rewards.inactivityWarning.daysUntilReset} dagen wordt je streak gereset. Begin vandaag weer!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streak reset banner */}
      {rewards.streakReset && (
        <Card className="border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-700">
          <CardContent className="p-3 flex items-start gap-3">
            <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-800 dark:text-blue-300">
                Je streak is gereset
              </p>
              <p className="text-blue-700 dark:text-blue-400 mt-0.5">
                Na 3 maanden inactiviteit is je streak gereset. Je scores, badges en level blijven behouden!
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <ScoreCard
          title="Mental Fitness"
          score={rewards.mentalFitnessScore}
          icon={<Brain className="h-5 w-5 text-primary-foreground" />}
          color="bg-primary"
        />
        <ScoreCard
          title="Pers. Doelen"
          score={rewards.personalGoalsScore}
          icon={<Target className="h-5 w-5 text-orange-50" />}
          color="bg-orange-500"
        />
        <ScoreCard
          title="Gewoontes"
          score={rewards.goodHabitsScore}
          icon={<Heart className="h-5 w-5 text-pink-50" />}
          color="bg-pink-500"
        />
      </div>
    </div>
  )
}
