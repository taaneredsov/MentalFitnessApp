import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Target, Calendar, Sparkles } from 'lucide-react'

interface WelcomeScreenProps {
  onStart: () => void
}

const STEPS = [
  {
    icon: Target,
    title: 'Stap 1',
    description: 'Vertel ons wat je wilt bereiken'
  },
  {
    icon: Calendar,
    title: 'Stap 2',
    description: 'Kies wanneer het jou uitkomt'
  },
  {
    icon: Sparkles,
    title: 'Stap 3',
    description: 'Krijg je persoonlijke plan'
  }
]

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [stepsVisible, setStepsVisible] = useState<boolean[]>([false, false, false])

  // Check for reduced motion preference
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Entrance animation
  useEffect(() => {
    if (prefersReducedMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing animation state for reduced motion
      setIsVisible(true)
      setStepsVisible([true, true, true])
      return
    }

    // Fade in header
    const headerTimer = setTimeout(() => setIsVisible(true), 100)

    // Stagger step reveals
    const stepTimers = STEPS.map((_, index) =>
      setTimeout(() => {
        setStepsVisible(prev => {
          const next = [...prev]
          next[index] = true
          return next
        })
      }, 300 + index * 150)
    )

    return () => {
      clearTimeout(headerTimer)
      stepTimers.forEach(clearTimeout)
    }
  }, [prefersReducedMotion])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 bg-background">
      {/* Logo and Header */}
      <div
        className={`text-center mb-8 transition-all duration-500 ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
        style={prefersReducedMotion ? { opacity: 1, transform: 'none' } : undefined}
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
          <img
            src="/pwa-512x512.svg"
            alt="Mental Fitness"
            className="w-12 h-12"
          />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Nieuw programma maken
        </h1>
        <p className="text-muted-foreground">
          In een paar stappen maken we samen een programma dat bij jou past.
        </p>
      </div>

      {/* Steps */}
      <div className="w-full max-w-sm space-y-0 mb-8">
        {STEPS.map((step, index) => {
          const Icon = step.icon
          const isStepVisible = stepsVisible[index]
          const isLastStep = index === STEPS.length - 1

          return (
            <div key={step.title} className="relative">
              {/* Step Card */}
              <div
                className={`flex items-start gap-4 p-4 rounded-xl border bg-card transition-all duration-300 ${
                  isStepVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
                style={prefersReducedMotion ? { opacity: 1, transform: 'none' } : undefined}
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>

              {/* Connecting line */}
              {!isLastStep && (
                <div
                  className={`absolute left-[1.875rem] top-[calc(100%-0.5rem)] w-0.5 h-4 bg-border transition-opacity duration-300 ${
                    isStepVisible ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={prefersReducedMotion ? { opacity: 1 } : undefined}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div
        className={`w-full max-w-sm text-center transition-all duration-500 delay-500 ${
          isVisible
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4'
        }`}
        style={prefersReducedMotion ? { opacity: 1, transform: 'none' } : undefined}
      >
        <p className="text-sm text-muted-foreground mb-2">
          Geen zorgen - je kunt je keuzes later altijd aanpassen.
        </p>
        <p className="text-xs text-muted-foreground mb-6">
          Dit duurt ongeveer 2 minuten.
        </p>
        <Button
          onClick={onStart}
          className="w-full h-12 text-base"
          size="lg"
        >
          Maak mijn programma
        </Button>
      </div>
    </div>
  )
}
