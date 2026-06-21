import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/hooks/useLanguage";
import { useTheme } from "@/contexts/ThemeContext";
import { formatNumber } from "@/lib/utils";
import type { AnalyticsHistory } from "@/types";

// HSL token values mirrored from index.css so Recharts (SVG attributes, where
// CSS `var()` doesn't resolve) can switch palettes with the active theme.
const AXIS_STROKE = {
  light: "hsl(240 3.8% 46.1%)",
  dark: "hsl(235 15% 55%)",
} as const;
const GRID_STROKE = {
  light: "hsl(240 5.9% 90%)",
  dark: "hsl(235 15% 13%)",
} as const;
const TOOLTIP_BG = {
  light: "hsl(0 0% 100%)",
  dark: "hsl(235 18% 7%)",
} as const;

export function AnalyticsChart({ history }: { history: AnalyticsHistory[] }) {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const axisStroke = AXIS_STROKE[theme];
  const gridStroke = GRID_STROKE[theme];

  // aggregate total followers per recorded day across platforms
  const data = useMemo(() => {
    const byDay = new Map<string, number>();
    history.forEach((h) => {
      const day = h.recorded_at.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + h.followers_count);
    });
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, followers]) => ({
        date: date.slice(5),
        followers,
      }));
  }, [history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.growth")}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length < 2 ? (
          <div className="flex h-[260px] items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t("profile.growthPending")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: axisStroke }}
                stroke={axisStroke}
                interval={4}
              />
              <YAxis
                tickFormatter={(v) => formatNumber(v)}
                tick={{ fontSize: 11, fill: axisStroke }}
                stroke={axisStroke}
                width={48}
              />
              <Tooltip
                formatter={(v: number) => [formatNumber(v), t("league.followers")]}
                contentStyle={{
                  borderRadius: 12,
                  border: `1px solid ${gridStroke}`,
                  background: TOOLTIP_BG[theme],
                  color: axisStroke,
                }}
              />
              <Line
                type="monotone"
                dataKey="followers"
                stroke="hsl(330 100% 60%)"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
