import { useState } from "react";
import { Zap, AlertTriangle, Shuffle, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common";
import { admin } from "@/lib/api";
import { mockDB, persist } from "@/lib/mock-data";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";

export default function GodMode() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const shuffleRanks = () => {
    const ranks = mockDB.influencer_profiles.map((_, i) => i + 1).sort(() => Math.random() - 0.5);
    mockDB.influencer_profiles.forEach((inf, i) => (inf.league_rank = ranks[i]));
    persist(mockDB);
    toast({ title: "League ranks shuffled", variant: "success" });
  };

  const resetData = () => {
    setBusy(true);
    admin.reset();
    toast({ title: "Mock database reset to seed", variant: "success" });
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div>
      <PageHeader title={t("nav.godMode")} subtitle="Superadmin operations" />

      <Card className="mb-4 border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <p className="text-sm dark:text-muted-foreground">
            These operations bypass normal safeguards. Use with care.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="dark:bg-card dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-primary" /> Bulk Rank Update
            </CardTitle>
            <CardDescription>Randomly reshuffle league ranks for all bloggers.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={shuffleRanks}>
              <Zap className="h-4 w-4" /> Shuffle Ranks
            </Button>
          </CardContent>
        </Card>

        <Card className="dark:bg-card dark:border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-destructive" /> Reset Data
            </CardTitle>
            <CardDescription>Restore the entire mock database to its seeded state.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Reset Data
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Reset Data
            </DialogTitle>
            <DialogDescription>
              This restores the entire mock database to its seeded state. All locally created
              accounts, campaigns, bids, deals and messages will be permanently lost. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={resetData} disabled={busy}>
              {t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
