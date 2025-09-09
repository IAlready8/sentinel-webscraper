/**
 * IMPLEMENTATION PLAN:
 * 1. Build WebSocket server with real-time data streaming
 * 2. Implement dashboard state management with live updates
 * 3. Add metrics aggregation and visualization data preparation
 * 4. Create alert system with customizable thresholds
 * 5. Integrate performance monitoring and resource tracking
 */

import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { parse } from 'url';
import { v4 as uuidv4 } from 'uuid';
import chalk from 'chalk';

// ✅ Core Types and Interfaces
export interface DashboardClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  lastPing: number;
  metadata: {
    userAgent: string;
    ip: string;
    connectedAt: number;
  };
}

export interface DashboardMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  category: 'performance' | 'scraping' | 'system' | 'business';
  trend: 'up' | 'down' | 'stable';
  alert?: {
    level: 'info' | 'warning' | 'error';
    message: string;
    threshold: number;
  };
}

export interface DashboardUpdate {
  type: 'metric' | 'alert' | 'status' | 'log' | 'data';
  data: any;
  timestamp: number;
  channel: string;
}

export interface AlertRule {
  id: string;
  metricName: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMs: number;
  lastTriggered?: number;
}

export interface DashboardConfig {
  port: number;
  enableAuth: boolean;
  maxConnections: number;
  pingInterval: number;
  metricsRetentionMs: number;
  enableCompression: boolean;
  enableHeartbeat: boolean;
}

// ✅ Metrics Aggregator
class MetricsAggregator {
  private metrics = new Map<string, DashboardMetric[]>();
  private retentionMs: number;

  constructor(retentionMs: number = 3600000) { // 1 hour default
    this.retentionMs = retentionMs;
    
    // Cleanup old metrics every 5 minutes
    setInterval(() => this.cleanupOldMetrics(), 300000);
  }

  public addMetric(metric: DashboardMetric): void {
    const key = metric.name;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metricArray = this.metrics.get(key)!;
    metricArray.push(metric);
    
    // Calculate trend
    if (metricArray.length >= 2) {
      const previous = metricArray[metricArray.length - 2];
      if (metric.value > previous.value) {
        metric.trend = 'up';
      } else if (metric.value < previous.value) {
        metric.trend = 'down';
      } else {
        metric.trend = 'stable';
      }
    }
    
    // Keep only recent metrics
    const cutoff = Date.now() - this.retentionMs;
    this.metrics.set(key, metricArray.filter(m => m.timestamp > cutoff));
  }

  public getMetric(name: string, timeRange?: number): DashboardMetric[] {
    const metrics = this.metrics.get(name) || [];
    
    if (timeRange) {
      const cutoff = Date.now() - timeRange;
      return metrics.filter(m => m.timestamp > cutoff);
    }
    
    return metrics;
  }

  public getLatestMetrics(): Map<string, DashboardMetric> {
    const latest = new Map<string, DashboardMetric>();
    
    for (const [name, metrics] of this.metrics) {
      if (metrics.length > 0) {
        latest.set(name, metrics[metrics.length - 1]);
      }
    }
    
    return latest;
  }

  public getAggregatedStats(name: string, timeRange: number): {
    min: number;
    max: number;
    avg: number;
    count: number;
  } {
    const metrics = this.getMetric(name, timeRange);
    
    if (metrics.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0 };
    }
    
    const values = metrics.map(m => m.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    return { min, max, avg: Math.round(avg * 100) / 100, count: values.length };
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.retentionMs;
    
    for (const [name, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp > cutoff);
      
      if (filtered.length === 0) {
        this.metrics.delete(name);
      } else {
        this.metrics.set(name, filtered);
      }
    }
  }
}

// ✅ Alert Manager
class AlertManager extends EventEmitter {
  private rules = new Map<string, AlertRule>();
  private activeAlerts = new Map<string, DashboardMetric>();

  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    console.log(chalk.blue(`🚨 Alert rule added: ${rule.metricName} ${rule.condition} ${rule.threshold}`));
  }

  public removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    console.log(chalk.blue(`🗑️ Alert rule removed: ${ruleId}`));
  }

  public checkMetric(metric: DashboardMetric): DashboardMetric {
    const rule = Array.from(this.rules.values()).find(r => 
      r.metricName === metric.name && r.enabled
    );

    if (!rule) return metric;

    // Check cooldown
    if (rule.lastTriggered && 
        Date.now() - rule.lastTriggered < rule.cooldownMs) {
      return metric;
    }

    let triggered = false;
    
    switch (rule.condition) {
      case 'greater_than':
        triggered = metric.value > rule.threshold;
        break;
      case 'less_than':
        triggered = metric.value < rule.threshold;
        break;
      case 'equals':
        triggered = metric.value === rule.threshold;
        break;
      case 'not_equals':
        triggered = metric.value !== rule.threshold;
        break;
    }

    if (triggered) {
      const alertLevel = this.mapSeverityToLevel(rule.severity);
      
      metric.alert = {
        level: alertLevel,
        message: `${metric.name} is ${metric.value}${metric.unit}, threshold: ${rule.threshold}`,
        threshold: rule.threshold,
      };

      rule.lastTriggered = Date.now();
      this.activeAlerts.set(metric.id, metric);
      
      console.log(chalk.red(`🚨 ALERT: ${metric.alert.message}`));
      this.emit('alert:triggered', { rule, metric });
    }

    return metric;
  }

  private mapSeverityToLevel(severity: string): 'info' | 'warning' | 'error' {
    switch (severity) {
      case 'low': return 'info';
      case 'medium': return 'warning';
      case 'high':
      case 'critical': return 'error';
      default: return 'info';
    }
  }

  public getActiveAlerts(): DashboardMetric[] {
    return Array.from(this.activeAlerts.values());
  }

  public clearAlert(alertId: string): void {
    this.activeAlerts.delete(alertId);
  }
}

// ✅ System Monitor
class SystemMonitor {
  private isMonitoring = false;
  private monitorInterval?: NodeJS.Timer;

  constructor(private metricsAggregator: MetricsAggregator) {}

  public startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitorInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
    
    console.log(chalk.green('📊 System monitoring started'));
  }

  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = undefined;
    }
    this.isMonitoring = false;
    
    console.log(chalk.yellow('📊 System monitoring stopped'));
  }

  private collectSystemMetrics(): void {
    const timestamp = Date.now();
    
    // Memory metrics
    const memUsage = process.memoryUsage();
    this.metricsAggregator.addMetric({
      id: uuidv4(),
      name: 'memory_heap_used',
      value: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      unit: 'MB',
      timestamp,
      category: 'system',
      trend: 'stable',
    });

    this.metricsAggregator.addMetric({
      id: uuidv4(),
      name: 'memory_heap_total',
      value: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      unit: 'MB',
      timestamp,
      category: 'system',
      trend: 'stable',
    });

    // CPU usage approximation
    const cpuUsage = process.cpuUsage();
    this.metricsAggregator.addMetric({
      id: uuidv4(),
      name: 'cpu_user_time',
      value: Math.round(cpuUsage.user / 1000), // ms
      unit: 'ms',
      timestamp,
      category: 'system',
      trend: 'stable',
    });

    // Uptime
    this.metricsAggregator.addMetric({
      id: uuidv4(),
      name: 'uptime',
      value: Math.round(process.uptime()),
      unit: 'seconds',
      timestamp,
      category: 'system',
      trend: 'up',
    });
  }
}

// ✅ Main Dashboard Manager
export class RealtimeDashboardManager extends EventEmitter {
  private config: DashboardConfig;
  private server?: Server;
  private wss?: WebSocketServer;
  private clients = new Map<string, DashboardClient>();
  private metricsAggregator: MetricsAggregator;
  private alertManager: AlertManager;
  private systemMonitor: SystemMonitor;
  private heartbeatInterval?: NodeJS.Timer;

  constructor(config: Partial<DashboardConfig> = {}) {
    super();

    this.config = {
      port: 8080,
      enableAuth: false,
      maxConnections: 100,
      pingInterval: 30000,
      metricsRetentionMs: 3600000, // 1 hour
      enableCompression: true,
      enableHeartbeat: true,
      ...config,
    };

    this.metricsAggregator = new MetricsAggregator(this.config.metricsRetentionMs);
    this.alertManager = new AlertManager();
    this.systemMonitor = new SystemMonitor(this.metricsAggregator);

    // Setup alert handling
    this.alertManager.on('alert:triggered', (data) => {
      this.broadcast('alert', data, 'alerts');
    });
  }

  // ✅ Server Management
  public async start(): Promise<void> {
    try {
      // Create HTTP server
      this.server = createServer();
      
      // Create WebSocket server
      this.wss = new WebSocketServer({
        server: this.server,
        perMessageDeflate: this.config.enableCompression,
      });

      // Setup WebSocket handling
      this.wss.on('connection', (ws, request) => {
        this.handleNewConnection(ws, request);
      });

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server!.listen(this.config.port, (error?: Error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Start system monitoring
      this.systemMonitor.startMonitoring();

      // Start heartbeat
      if (this.config.enableHeartbeat) {
        this.startHeartbeat();
      }

      console.log(chalk.green(`🚀 Dashboard server started on port ${this.config.port}`));
      this.emit('server:started');

    } catch (error) {
      console.error(chalk.red(`❌ Failed to start dashboard server: ${error}`));
      throw error;
    }
  }

  private handleNewConnection(ws: WebSocket, request: any): void {
    // Check connection limit
    if (this.clients.size >= this.config.maxConnections) {
      ws.close(1013, 'Server at capacity');
      return;
    }

    const clientId = uuidv4();
    const client: DashboardClient = {
      id: clientId,
      ws,
      subscriptions: new Set(),
      lastPing: Date.now(),
      metadata: {
        userAgent: request.headers['user-agent'] || 'Unknown',
        ip: request.socket.remoteAddress || 'Unknown',
        connectedAt: Date.now(),
      },
    };

    this.clients.set(clientId, client);

    console.log(chalk.blue(`👤 New client connected: ${clientId} (${this.clients.size} total)`));

    // Setup message handling
    ws.on('message', (data) => {
      this.handleClientMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleClientDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(chalk.red(`❌ Client error: ${clientId} - ${error}`));
      this.handleClientDisconnect(clientId);
    });

    // Send initial data
    this.sendToClient(clientId, {
      type: 'status',
      data: { 
        connected: true, 
        clientId,
        serverTime: Date.now(),
        metrics: Array.from(this.metricsAggregator.getLatestMetrics().values()),
      },
      timestamp: Date.now(),
      channel: 'system',
    });

    this.emit('client:connected', client);
  }

  private handleClientMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          client.subscriptions.add(message.channel);
          console.log(chalk.blue(`📡 Client ${clientId} subscribed to: ${message.channel}`));
          break;
          
        case 'unsubscribe':
          client.subscriptions.delete(message.channel);
          console.log(chalk.blue(`📡 Client ${clientId} unsubscribed from: ${message.channel}`));
          break;
          
        case 'ping':
          client.lastPing = Date.now();
          this.sendToClient(clientId, {
            type: 'pong',
            data: { timestamp: Date.now() },
            timestamp: Date.now(),
            channel: 'system',
          });
          break;
          
        case 'get_metrics':
          const timeRange = message.timeRange || 3600000; // 1 hour default
          const metrics: Record<string, any> = {};
          
          for (const metricName of message.metrics || []) {
            metrics[metricName] = {
              data: this.metricsAggregator.getMetric(metricName, timeRange),
              stats: this.metricsAggregator.getAggregatedStats(metricName, timeRange),
            };
          }
          
          this.sendToClient(clientId, {
            type: 'metrics_data',
            data: metrics,
            timestamp: Date.now(),
            channel: 'metrics',
          });
          break;
      }
    } catch (error) {
      console.error(chalk.red(`❌ Invalid message from client ${clientId}: ${error}`));
    }
  }

  private handleClientDisconnect(clientId: string): void {
    this.clients.delete(clientId);
    console.log(chalk.yellow(`👋 Client disconnected: ${clientId} (${this.clients.size} remaining)`));
    this.emit('client:disconnected', { clientId });
  }

  // ✅ Broadcasting and Communication
  public addMetric(metric: DashboardMetric): void {
    // Process through alert manager
    const processedMetric = this.alertManager.checkMetric(metric);
    
    // Add to aggregator
    this.metricsAggregator.addMetric(processedMetric);
    
    // Broadcast to subscribers
    this.broadcast('metric', processedMetric, 'metrics');
  }

  public broadcast(type: string, data: any, channel: string = 'general'): void {
    const update: DashboardUpdate = {
      type: type as any,
      data,
      timestamp: Date.now(),
      channel,
    };

    const message = JSON.stringify(update);
    let broadcastCount = 0;

    for (const client of this.clients.values()) {
      if (client.subscriptions.has(channel) || channel === 'system') {
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(message);
            broadcastCount++;
          }
        } catch (error) {
          console.error(chalk.red(`❌ Broadcast error to ${client.id}: ${error}`));
        }
      }
    }

    if (broadcastCount > 0) {
      console.log(chalk.green(`📡 Broadcasted ${type} to ${broadcastCount} clients on channel: ${channel}`));
    }
  }

  private sendToClient(clientId: string, update: DashboardUpdate): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(update));
    } catch (error) {
      console.error(chalk.red(`❌ Send error to ${clientId}: ${error}`));
    }
  }

  // ✅ Alert Management
  public addAlertRule(rule: AlertRule): void {
    this.alertManager.addRule(rule);
    this.broadcast('alert_rule', { action: 'added', rule }, 'alerts');
  }

  public removeAlertRule(ruleId: string): void {
    this.alertManager.removeRule(ruleId);
    this.broadcast('alert_rule', { action: 'removed', ruleId }, 'alerts');
  }

  // ✅ Heartbeat System
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const staleClients: string[] = [];

      for (const [clientId, client] of this.clients) {
        if (now - client.lastPing > this.config.pingInterval * 2) {
          staleClients.push(clientId);
        }
      }

      // Remove stale clients
      staleClients.forEach(clientId => {
        const client = this.clients.get(clientId);
        if (client) {
          client.ws.terminate();
          this.handleClientDisconnect(clientId);
        }
      });

      // Send heartbeat to remaining clients
      this.broadcast('heartbeat', { timestamp: now }, 'system');

    }, this.config.pingInterval);
  }

  // ✅ Analytics and Status
  public getStatus(): Record<string, any> {
    return {
      server: {
        uptime: process.uptime(),
        port: this.config.port,
        clients: this.clients.size,
        maxConnections: this.config.maxConnections,
      },
      metrics: {
        totalMetrics: Array.from(this.metricsAggregator.getLatestMetrics().keys()).length,
        activeAlerts: this.alertManager.getActiveAlerts().length,
      },
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        subscriptions: Array.from(client.subscriptions),
        connectedFor: Date.now() - client.metadata.connectedAt,
        lastPing: Date.now() - client.lastPing,
      })),
    };
  }

  // ✅ Log Management
  public logEvent(level: 'info' | 'warning' | 'error', message: string, data?: any): void {
    const logEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
    };

    this.broadcast('log', logEntry, 'logs');
    
    const colorFn = level === 'error' ? chalk.red : level === 'warning' ? chalk.yellow : chalk.blue;
    console.log(colorFn(`📝 [${level.toUpperCase()}] ${message}`));
  }

  // ✅ Data Export
  public exportMetrics(metricNames: string[], timeRange: number): Record<string, any> {
    const exported: Record<string, any> = {};
    
    for (const name of metricNames) {
      exported[name] = {
        data: this.metricsAggregator.getMetric(name, timeRange),
        stats: this.metricsAggregator.getAggregatedStats(name, timeRange),
      };
    }
    
    return {
      metrics: exported,
      exportedAt: Date.now(),
      timeRange,
      totalDataPoints: Object.values(exported).reduce((sum: number, metric: any) => sum + metric.data.length, 0),
    };
  }

  // ✅ Shutdown
  public async shutdown(): Promise<void> {
    console.log(chalk.yellow('🛑 Shutting down dashboard server...'));

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Stop system monitoring
    this.systemMonitor.stopMonitoring();

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
    }

    console.log(chalk.green('✅ Dashboard server shutdown complete'));
  }
}

// ✅ Export for integration
export default RealtimeDashboardManager;
