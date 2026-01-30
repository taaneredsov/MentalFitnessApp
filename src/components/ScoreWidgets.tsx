import { Card, CardContent } from "@/components/ui/card"
import { useUserRewards } from "@/hooks/queries"
import { Brain, Target, Heart, Loader2 } from "lucide-react"

interface ScoreCardProps {
  title: string
  score: number
  icon: React.ReactNode
  color: string
}

function ScoreCard({ title, score, icon, color }: ScoreCardProps) {
  return (
    <Card className="flex-1">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-xl font-bold">{score}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ScoreWidgets() {
  const { data: rewards, isLoading } = useUserRewards()

  if (isLoading) {
    return (
      <div className="flex gap-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="flex-1">
            <CardContent className="pt-4 pb-4 flex items-center justify-center h-[72px]">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!rewards) return null

  return (
    <div className="flex gap-3">
      <ScoreCard
        title="Mental Fitness"
        score={rewards.mentalFitnessScore}
        icon={<Brain className="h-5 w-5 text-primary-foreground" />}
        color="bg-primary"
      />
      <ScoreCard
        title="Persoonlijke Doelen"
        score={rewards.personalGoalsScore}
        icon={<Target className="h-5 w-5 text-orange-50" />}
        color="bg-orange-500"
      />
      <ScoreCard
        title="Goede Gewoontes"
        score={rewards.goodHabitsScore}
        icon={<Heart className="h-5 w-5 text-pink-50" />}
        color="bg-pink-500"
      />
    </div>
  )
}
