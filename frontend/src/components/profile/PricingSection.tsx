import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LockOverlay } from "./LockOverlay";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD } from "@/lib/utils";
import type { AdvertisingPrice } from "@/types";

export function PricingSection({
  prices,
  locked,
  subscribeTo,
}: {
  prices: AdvertisingPrice[];
  locked: boolean;
  subscribeTo?: string;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.prices")}</CardTitle>
      </CardHeader>
      <CardContent>
        <LockOverlay locked={locked} subscribeTo={subscribeTo}>
          {prices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.none")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("influencer.advertisingPrices")}</TableHead>
                  <TableHead>{t("influencer.description")}</TableHead>
                  <TableHead className="text-right">{t("deals.agreedPrice")}</TableHead>
                  <TableHead className="text-right">Delivery</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{t(`adType.${p.ad_type}`)}</Badge>
                        {!p.is_public && (
                          <Badge variant="outline" className="text-[10px]">
                            Pro
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {p.description}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatUSD(p.price_usd)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.delivery_days}d
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </LockOverlay>
      </CardContent>
    </Card>
  );
}
