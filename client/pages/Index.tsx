import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Shield, Gauge, PlugZap, Activity, Server } from "lucide-react";

export default function Index() {
  return (
    <div className="bg-background">
      <Hero />
      <Highlights />
      <FeatureGrid />
      <CTA />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/10 to-transparent" />
      <div className="container relative py-24 md:py-28">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <Badge className="bg-primary/15 text-primary">Enterprise</Badge>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Enterprise-Grade Web Scraping System
            </h1>
            <p className="text-foreground/70 text-lg">
              Advanced browser automation with stealth capabilities, intelligent proxy
              rotation, dynamic rate limiting, and a real-time analytics dashboard.
              Production-ready from day one.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/dashboard">
                <Button size="lg" className="bg-primary text-primary-foreground">
                  Open Live Dashboard
                </Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="outline">Explore Features</Button>
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 blur-xl" />
            <Card className="relative">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BarChart3 className="h-5 w-5 text-primary" /> Realtime Metrics Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Metric label="Requests/min" value="12,480" trend="up" delta="3.2%" />
                  <Metric label="Success rate" value="96.4%" trend="up" delta="1.1%" />
                  <Metric label="Avg latency" value="0.86s" trend="down" delta="-4.5%" />
                  <Metric label="Active proxies" value="128" trend="stable" />
                </div>
                <div className="mt-6 h-24 rounded-md bg-gradient-to-r from-primary/20 via-accent/20 to-transparent" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, trend, delta }: { label: string; value: string; trend: "up"|"down"|"stable"; delta?: string }) {
  const color = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-rose-600" : "text-foreground/60";
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-foreground/60">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
      {delta && <div className={`text-xs ${color}`}>{delta}</div>}
    </div>
  );
}

function Highlights() {
  return (
    <section id="features" className="container py-16 md:py-20">
      <div className="grid gap-6 md:grid-cols-3">
        <Feature icon={<Shield className="h-5 w-5" />} title="Stealth Automation" desc="Anti-detection mechanisms with user-agent and fingerprint rotation, headless hardening, and automation signal suppression." />
        <Feature icon={<Server className="h-5 w-5" />} title="Proxy Intelligence" desc="Sophisticated proxy pool with validation, adaptive rotation, and health scoring for true resilience." />
        <Feature icon={<Gauge className="h-5 w-5" />} title="Dynamic Rate Limits" desc="Global and per-domain throttling with burst control to respect targets and avoid bans." />
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section className="bg-secondary/30 border-y">
      <div className="container py-16 md:py-20 grid gap-6 md:grid-cols-3">
        <InfoCard icon={<Activity className="h-5 w-5 text-primary" />} title="Monitoring & Alerts" points={["p95, p99, error rates", "Resource & health checks", "Email/Webhook notifications"]} />
        <InfoCard icon={<BarChart3 className="h-5 w-5 text-primary" />} title="Realtime Analytics" points={["Time-series dashboards", "Proxy health & latency", "Form, table, image insights"]} />
        <InfoCard icon={<PlugZap className="h-5 w-5 text-primary" />} title="Extensible Addons" points={["Plugin architecture", "Config hot-reload", "Typed API & storage"]} />
      </div>
    </section>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border p-6 bg-card">
      <div className="flex items-center gap-2 text-foreground/80">
        <div className="rounded-md bg-primary/15 text-primary p-2">{icon}</div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-foreground/70">{desc}</p>
    </div>
  );
}

function InfoCard({ icon, title, points }: { icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm text-foreground/70">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CTA() {
  return (
    <section className="container py-16 md:py-24">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-accent/10 p-8 md:p-12 text-center">
        <h2 className="text-2xl md:text-3xl font-bold">Ready for production. Built to scale.</h2>
        <p className="mt-3 text-foreground/70 max-w-2xl mx-auto">
          Configure once and run. Advanced monitoring, error recovery, and data validation ensure enterprise-grade reliability.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button size="lg" className="bg-primary text-primary-foreground">Launch Dashboard</Button>
          </Link>
          <a href="#features">
            <Button size="lg" variant="outline">View Key Features</Button>
          </a>
        </div>
      </div>
    </section>
  );
}
