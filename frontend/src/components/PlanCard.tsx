import { Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlanDef } from "@/lib/plans";

export function PlanCard({
  plan,
  cta,
  onSelect,
  current,
  loading,
  delay = 0,
}: {
  plan: PlanDef;
  cta: string;
  onSelect?: () => void;
  current?: boolean;
  loading?: boolean;
  /** Stagger the entry animation (seconds). */
  delay?: number;
}) {
  return (
    <Card
      style={delay ? { animationDelay: `${delay}s` } : undefined}
      className={cn(
        "relative flex animate-fade-scale flex-col overflow-hidden transition-all duration-300",
        plan.highlight
          ? "border-primary/60 shadow-glow lg:-translate-y-2 lg:scale-[1.02]"
          : "hover:-translate-y-1 hover:shadow-md",
      )}
    >
      {/* Featured accent bar */}
      {plan.highlight && <div aria-hidden className="absolute inset-x-0 top-0 h-1 gradient-primary" />}

      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">{plan.name}</h3>
          {plan.highlight && <Badge variant="gradient">Popular</Badge>}
          {current && <Badge variant="success">Current</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight tabular">{plan.price}</span>
          <span className="text-muted-foreground">{plan.cadence}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="flex-1 space-y-3">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                  plan.highlight ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {onSelect && (
          <Button
            className="mt-6 w-full"
            size="lg"
            variant={plan.highlight ? "gradient" : "outline"}
            onClick={onSelect}
            loading={loading}
            disabled={current || loading}
          >
            {current ? "Active" : cta}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
