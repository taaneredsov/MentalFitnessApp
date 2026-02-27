import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Check, Loader2, Plus, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useOvertuigingsByGoals } from "@/hooks/queries"
import type { StepProps } from "./types"

export function OvertuigingenStep({ state, updateState, onNext, onBack }: StepProps) {
  const { t } = useTranslation()
  const { data: overtuigingen = [], isLoading } = useOvertuigingsByGoals(state.goals)
  const [customInput, setCustomInput] = useState("")

  // Sort by order
  const sorted = useMemo(() => {
    return [...overtuigingen].sort((a, b) => a.order - b.order)
  }, [overtuigingen])

  // Auto-select up to 3 on first load (only if none selected yet)
  useEffect(() => {
    if (sorted.length > 0 && state.overtuigingen.length === 0) {
      const autoSelected = sorted.slice(0, 3).map(o => o.id)
      updateState({ overtuigingen: autoSelected })
    }
  }, [sorted, state.overtuigingen.length, updateState])

  const toggleOvertuiging = (id: string) => {
    const newSelection = state.overtuigingen.includes(id)
      ? state.overtuigingen.filter(oId => oId !== id)
      : [...state.overtuigingen, id]
    updateState({ overtuigingen: newSelection })
  }

  const addCustom = () => {
    const trimmed = customInput.trim()
    if (!trimmed || trimmed.length > 200) return
    updateState({
      customOvertuigingen: [
        ...state.customOvertuigingen,
        { tempId: crypto.randomUUID(), name: trimmed }
      ]
    })
    setCustomInput("")
  }

  const removeCustom = (tempId: string) => {
    updateState({
      customOvertuigingen: state.customOvertuigingen.filter(c => c.tempId !== tempId)
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-4">
          {t("wizard.overtuigingen.selectPrompt")}
        </p>

        {sorted.length === 0 && state.customOvertuigingen.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {t("wizard.overtuigingen.noResults")}
          </p>
        ) : (
          <div className="space-y-2">
            {sorted.map(overtuiging => {
              const isSelected = state.overtuigingen.includes(overtuiging.id)
              return (
                <button
                  key={overtuiging.id}
                  onClick={() => toggleOvertuiging(overtuiging.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors bg-background ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center ${
                        isSelected
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-muted-foreground"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className="font-medium">{overtuiging.name}</p>
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Custom overtuigingen */}
            {state.customOvertuigingen.map(custom => (
              <div
                key={custom.tempId}
                className="w-full p-4 rounded-lg border border-primary bg-primary/5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 rounded bg-primary border-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{custom.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                        {t("wizard.overtuigingen.custom")}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeCustom(custom.tempId)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Inline custom input */}
        <div className="flex gap-2 mt-3">
          <Input
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder={t("wizard.overtuigingen.customPlaceholder")}
            maxLength={200}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustom()
              }
            }}
          />
          <Button
            size="icon"
            variant="outline"
            onClick={addCustom}
            disabled={!customInput.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Sticky navigation */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 mt-6">
        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onBack} disabled={state.isSaving}>
            {t("common.back")}
          </Button>
          <Button onClick={onNext} disabled={state.isSaving}>
            {state.isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("common.loading")}
              </>
            ) : (
              t("common.next")
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
