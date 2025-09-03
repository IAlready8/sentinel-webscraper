/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export interface TimePoint {
  t: number;
  total: number;
  success: number;
  failed: number;
  avg: number;
  p95: number;
}

export interface ProxyStat {
  proxy: string;
  success: number;
  failure: number;
  avgResponse: number;
  health: number;
}

export type Severity = "info" | "warning" | "critical";

export interface AlertItem {
  id: string;
  type: string;
  message: string;
  severity: Severity;
  timestamp: number;
}

export interface MetricsSummary {
  total: number;
  successRate: number;
  avgResponseTime: number;
  p95ResponseTime: number;
  activeProxies: number;
}

export interface MetricsResponse {
  summary: MetricsSummary;
  series: TimePoint[];
  proxies: ProxyStat[];
  alerts: AlertItem[];
}

export interface ScrapeRequest {
  url?: string;
  urls?: string[];
}

export interface ScrapeItem {
  url: string;
  success: boolean;
  status?: number;
  title?: string;
  textPreview?: string;
  links?: { href: string; text?: string }[];
  metadata?: Record<string, string>;
  error?: string;
}

export interface ScrapeResponse {
  results: ScrapeItem[];
}
