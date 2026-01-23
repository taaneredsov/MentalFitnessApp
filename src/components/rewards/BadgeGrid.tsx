import { Star, Zap, Trophy, Award, Flame, Heart, CheckCircle, Crown, Lock } from "lucide-react"
import { getAllBadgesWithStatus } from "@/lib/rewards-utils"
import type { BadgeInfo } from "@/types/rewards"

interface BadgeGridProps {
  earnedBadges: string[]
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  star: Star,
  zap: Zap,
  trophy: Trophy,
  award: Award,
  flame: Flame,
  heart: Heart,
  "check-circle": CheckCircle,
  crown: Crown
}

function BadgeIcon({ icon, earned }: { icon: string; earned: boolean }) {
  const IconComponent = iconMap[icon] || Star

  if (!earned) {
    return <Lock className="h-6 w-6 text-muted-foreground/50" />
  }

  return <IconComponent className="h-6 w-6" />
}

/**
 * Grid of badges showing earned and locked badges
 */
export function BadgeGrid({ earnedBadges }: BadgeGridProps) {
  const badges = getAllBadgesWithStatus(earnedBadges)

  return (
    <div className="grid grid-cols-3 gap-3">
      {badges.map((badge) => (
        <BadgeItem key={badge.id} badge={badge} />
      ))}
    </div>
  )
}

function BadgeItem({ badge }: { badge: BadgeInfo & { earned: boolean } }) {
  return (
    <div
      className={`flex flex-col items-center p-3 rounded-xl transition-all ${
        badge.earned
          ? "bg-primary/10 text-primary"
          : "bg-muted/50 text-muted-foreground/50"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 ${
          badge.earned ? "bg-primary/20" : "bg-muted"
        }`}
      >
        <BadgeIcon icon={badge.icon} earned={badge.earned} />
      </div>
      <p className={`text-xs font-medium text-center line-clamp-2 ${badge.earned ? "" : "opacity-60"}`}>
        {badge.name}
      </p>
    </div>
  )
}
