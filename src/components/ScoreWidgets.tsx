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

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
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
    <div className="grid grid-cols-3 gap-2">
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
  )
}
