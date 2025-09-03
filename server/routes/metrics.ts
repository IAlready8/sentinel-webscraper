import type { RequestHandler } from "express";
import type {
  MetricsResponse,
  TimePoint,
  ProxyStat,
  AlertItem,
} from "@shared/api";

let initialized = false;
let series: TimePoint[] = [];
let proxies: ProxyStat[] = [];
let alerts: AlertItem[] = [];

function init() {
  if (initialized) return;
  initialized = true;
  const now = Date.now();
  // Seed proxies
  proxies = [
    {
      proxy: "proxy-a:8080",
      success: 0,
      failure: 0,
      avgResponse: 0.6,
      health: 0.98,
    },
    {
      proxy: "proxy-b:8080",
      success: 0,
      failure: 0,
      avgResponse: 0.9,
      health: 0.92,
    },
    {
      proxy: "proxy-c:8080",
      success: 0,
      failure: 0,
      avgResponse: 0.7,
      health: 0.96,
    },
    {
      proxy: "proxy-d:8080",
      success: 0,
      failure: 0,
      avgResponse: 1.4,
      health: 0.82,
    },
    {
      proxy: "proxy-e:8080",
      success: 0,
      failure: 0,
      avgResponse: 1.1,
      health: 0.88,
    },
  ];
  // Seed 60 points over last 10 minutes (10s interval)
  let total = 200;
  let success = 190;
  for (let i = 59; i >= 0; i--) {
    const t = now - i * 10_000;
    ({ total, success } = drift(total, success));
    const failed = Math.max(0, total - success);
    const avg = clamp(randn(0.85, 0.25), 0.2, 5);
    const p95 = clamp(avg + Math.abs(randn(0.6, 0.3)), avg + 0.2, 8);
    series.push({ t, total, success, failed, avg, p95 });
  }
}

function drift(total: number, success: number) {
  const delta = Math.round(randn(0, 8));
  total = clampInt(total + delta, 80, 600);
  const successRate = clamp(0.85 + randn(0, 0.05), 0.6, 0.995);
  success = Math.round(total * successRate);
  return { total, success };
}

function step() {
  const now = Date.now();
  const last = series[series.length - 1];
  const { total, success } = drift(last.total, last.success);
  const failed = Math.max(0, total - success);
  const avg = clamp(randn(last.avg, 0.1), 0.2, 5);
  const p95 = clamp(avg + Math.abs(randn(0.6, 0.25)), avg + 0.2, 8);
  series.push({ t: now, total, success, failed, avg, p95 });
  if (series.length > 360) series.shift();

  // Update proxies
  proxies = proxies.map((p) => {
    const ok = Math.random() > 0.05;
    const latency = clamp(randn(p.avgResponse, 0.08), 0.2, 3);
    return {
      ...p,
      success: p.success + (ok ? 1 : 0),
      failure: p.failure + (ok ? 0 : 1),
      avgResponse: latency,
      health: clamp(
        1 - p.failure / Math.max(1, p.success + p.failure) - randn(0.0, 0.01),
        0,
        1,
      ),
    };
  });

  // Alerts
  const errRate = failed / Math.max(1, total);
  const newAlerts: AlertItem[] = [];
  if (errRate > 0.2) {
    newAlerts.push({
      id: `err-${now}`,
      type: "high_error_rate",
      message: `Error rate ${(errRate * 100).toFixed(1)}% exceeds threshold`,
      severity: errRate > 0.35 ? "critical" : "warning",
      timestamp: now,
    });
  }
  if (p95 > 4.0) {
    newAlerts.push({
      id: `lat-${now}`,
      type: "slow_response",
      message: `p95 response time ${p95.toFixed(2)}s is high`,
      severity: p95 > 6 ? "critical" : "warning",
      timestamp: now,
    });
  }
  alerts = [...alerts.slice(-20), ...newAlerts];
}

function summarize(): MetricsResponse {
  const last = series[series.length - 1];
  const totalReq = series.reduce((a, p) => a + p.total, 0);
  const totalSucc = series.reduce((a, p) => a + p.success, 0);
  const summary = {
    total: totalReq,
    successRate: totalSucc / Math.max(1, totalReq),
    avgResponseTime: avg(series.map((p) => p.avg)),
    p95ResponseTime: avg(series.map((p) => p.p95)),
    activeProxies: proxies.length,
  };
  return { summary, series, proxies, alerts };
}

function avg(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0) / Math.max(1, nums.length);
}
function randn(mu = 0, sigma = 1) {
  // Box–Muller
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mu + z * sigma;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function clampInt(n: number, min: number, max: number) {
  return Math.round(clamp(n, min, max));
}

export const handleMetrics: RequestHandler = (_req, res) => {
  init();
  step();
  const data = summarize();
  res.status(200).json(data);
};
