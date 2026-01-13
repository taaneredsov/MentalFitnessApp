import { useNavigate } from "react-router-dom"
import { useMethods } from "@/hooks/queries"
import { Card, CardContent } from "@/components/ui/card"
import type { Method } from "@/types/program"
import { Loader2, Clock, Image as ImageIcon } from "lucide-react"

function MethodCard({
  method,
  onClick
}: {
  method: Method
  onClick: () => void
}) {
  return (
    <Card
      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <div className="aspect-video bg-muted relative">
        {method.photo ? (
          <img
            src={method.photo}
            alt={method.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <CardContent className="p-3">
        <h3 className="font-medium line-clamp-1">{method.name}</h3>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <Clock className="h-3.5 w-3.5" />
          <span>{method.duration} min</span>
          {method.experienceLevel && (
            <>
              <span className="mx-1">•</span>
              <span>{method.experienceLevel}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MethodsPage() {
  const navigate = useNavigate()

  // Use React Query for methods data (cached)
  const { data: methods = [], isLoading, error: methodsError } = useMethods()
  const error = methodsError ? "Kon methodes niet laden" : null

  const handleMethodClick = (id: string) => {
    navigate(`/methods/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold">Methodes</h2>

      {methods.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Geen methodes beschikbaar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {methods.map(method => (
            <MethodCard
              key={method.id}
              method={method}
              onClick={() => handleMethodClick(method.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
