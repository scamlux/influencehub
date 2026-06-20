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
        "flex animate-fade-scale flex-col",
        // featured card keeps its pink border in both modes
        plan.highlight
          ? "border-primary shadow-md dark:bg-card dark:glow-pink"
          : "dark:bg-card dark:border-border",
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">{plan.name}</h3>
          {plan.highlight && <Badge>Popular</Badge>}
          {current && <Badge variant="success">Current</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{plan.tagline}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-4xl font-bold dark:text-foreground">{plan.price}</span>
          <span className="text-muted-foreground">{plan.cadence}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <ul className="flex-1 space-y-3">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-foreground" />
              <span className="dark:text-foreground">{f}</span>
            </li>
          ))}
        </ul>
        {onSelect && (
          <Button
            className={cn(
              "mt-6 w-full",
              !plan.highlight && "dark:border-border dark:text-foreground dark:hover:bg-secondary",
            )}
            variant={plan.highlight ? "default" : "outline"}
            onClick={onSelect}
            disabled={current || loading}
          >
            {current ? "Active" : cta}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
