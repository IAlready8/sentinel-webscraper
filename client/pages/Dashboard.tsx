import { useQuery } from "@tanstack/react-query";
import type { MetricsResponse } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScraperPanel from "@/components/scraper/ScraperPanel";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

function useMetrics() {
  return useQuery<MetricsResponse>({
    queryKey: ["metrics"],
    queryFn: async () => {
      const res = await fetch("/api/metrics");
      if (!res.ok) throw new Error("Failed to load metrics");
      return (await res.json()) as MetricsResponse;
    },
    refetchInterval: 2000,
  });
}

export default function Dashboard() {
  const { data, isLoading } = useMetrics();

  return (
    <div className="container py-8 md:py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Operations</h1>
        <Badge className="bg-primary/15 text-primary">Realtime</Badge>
      </div>

      <Tabs defaultValue="analytics" className="space-y-8">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="scraper">Scraper</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics">
          {isLoading || !data ? (
            <LoadingState />
          ) : (
            <div className="space-y-8">
              <SummaryCards data={data} />
              <Charts data={data} />
              <div className="grid gap-6 md:grid-cols-2">
                <Proxies data={data} />
                <Alerts data={data} />
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="scraper">
          <ScraperPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}


function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function SummaryCards({ data }: { data: MetricsResponse }) {
  const { summary } = data;
  const items = [
    {
      label: "Requests (window)",
      value: Intl.NumberFormat().format(summary.total),
    },
    {
      label: "Success rate",
      value: `${(summary.successRate * 100).toFixed(1)}%`,
    },
    { label: "Avg response", value: `${summary.avgResponseTime.toFixed(2)}s` },
    { label: "p95 response", value: `${summary.p95ResponseTime.toFixed(2)}s` },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground/70">
              {it.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{it.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Charts({ data }: { data: MetricsResponse }) {
  const series = data.series.map((p) => ({
    time: new Date(p.t).toLocaleTimeString([], {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    total: p.total,
    success: p.success,
    failed: p.failed,
    avg: p.avg,
    p95: p.p95,
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Throughput</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ left: 10, right: 10 }}>
              <XAxis dataKey="time" hide tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="Total"
              />
              <Line
                type="monotone"
                dataKey="success"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name="Success"
              />
              <Line
                type="monotone"
                dataKey="failed"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                name="Failed"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latency (s)</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 10, right: 10 }}>
              <defs>
                <linearGradient id="fillAvg" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="hsl(var(--primary))"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillP95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" hide tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="avg"
                stroke="hsl(var(--primary))"
                fill="url(#fillAvg)"
                name="Avg"
              />
              <Area
                type="monotone"
                dataKey="p95"
                stroke="#06b6d4"
                fill="url(#fillP95)"
                name="p95"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function Proxies({ data }: { data: MetricsResponse }) {
  const { proxies } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proxy Health</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {proxies.map((p) => (
            <div key={p.proxy} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium">{p.proxy}</div>
                <div className="text-sm text-foreground/60">
                  {Math.round(p.health * 100)}%
                </div>
              </div>
              <div className="mt-2 text-sm text-foreground/60">
                avg {p.avgResponse.toFixed(2)}s • {p.success} ok / {p.failure}{" "}
                fail
              </div>
              <div className="mt-3 h-2 w-full rounded bg-secondary">
                <div
                  className="h-2 rounded bg-primary"
                  style={{
                    width: `${Math.max(4, Math.round(p.health * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Alerts({ data }: { data: MetricsResponse }) {
  const { alerts } = data;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-sm text-foreground/60">No active alerts</div>
        ) : (
          <ul className="space-y-3">
            {alerts
              .slice()
              .reverse()
              .map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <span
                    className={`mt-1 h-2 w-2 rounded-full ${a.severity === "critical" ? "bg-rose-500" : a.severity === "warning" ? "bg-amber-500" : "bg-emerald-500"}`}
                  />
                  <div>
                    <div className="text-sm font-medium">{a.type}</div>
                    <div className="text-sm text-foreground/70">
                      {a.message}
                    </div>
                    <div className="text-xs text-foreground/50">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
