import { useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Plus, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { StepProps } from "./types"

export function MethodsStep({
  state,
  updateState,
  methodsData,
  onNext,
  onBack,
  isLoading
}: StepProps) {
  const { t } = useTranslation()
  const [showAllMethods, setShowAllMethods] = useState(false)

  const selectedMethods = methodsData.filter((m) => state.methods.includes(m.id))
  const availableMethods = methodsData.filter((m) => !state.methods.includes(m.id))

  const removeMethod = (methodId: string) => {
    updateState({ methods: state.methods.filter((id) => id !== methodId) })
  }

  const addMethod = (methodId: string) => {
    updateState({ methods: [...state.methods, methodId] })
    setShowAllMethods(false)
  }

  if (isLoading || state.isPolling) {
    return (
      <div className="flex flex-col items-center justify-center h-48 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {state.isPolling
            ? t("wizard.methods.suggestingMethods")
            : t("common.loading")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1">
        <p className="text-sm text-muted-foreground mb-4">
          {state.methods.length > 0
            ? t("wizard.methods.suggestedPrompt")
            : t("wizard.methods.selectPrompt")}
        </p>

        {/* Selected methods */}
        {selectedMethods.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-sm font-medium">{t("wizard.methods.selectedMethods")}</p>
            {selectedMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-primary/5 border-primary"
              >
                {method.photo && (
                  <img
                    src={method.photo}
                    alt={method.name}
                    className="w-12 h-12 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-medium">{method.name}</p>
                  {method.duration > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {method.duration} min
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeMethod(method.id)}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add more methods */}
        {!showAllMethods ? (
          <Button
            variant="outline"
            onClick={() => setShowAllMethods(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("schedule.addMethod")}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{t("wizard.methods.availableMethods")}</p>
              <Button variant="ghost" size="sm" onClick={() => setShowAllMethods(false)}>
                {t("wizard.methods.close")}
              </Button>
            </div>
            <div className="space-y-2">
              {availableMethods.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  {t("wizard.methods.allSelected")}
                </p>
              ) : (
                availableMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => addMethod(method.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:border-primary/50 transition-colors text-left"
                  >
                    {method.photo && (
                      <img
                        src={method.photo}
                        alt={method.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{method.name}</p>
                      {method.duration > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {method.duration} min
                        </p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky navigation */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-background via-background to-transparent -mx-4 px-4 mt-6">
        <div className="flex justify-between border-t pt-4">
          <Button variant="outline" onClick={onBack}>
            {t("common.back")}
          </Button>
          <Button onClick={onNext}>
            {t("common.next")}
          </Button>
        </div>
      </div>
    </div>
  )
}
