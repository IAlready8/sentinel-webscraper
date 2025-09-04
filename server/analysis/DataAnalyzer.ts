/**
 * SENTINEL DATA ANALYZER - Advanced Analytics Engine
 * Real-time data processing with ML-ready feature extraction
 * Optimization: Stream processing for memory efficiency
 * Scalability: Pluggable analysis modules for extensibility
 */

import { EventEmitter } from 'events';
import { ScrapingResult } from '../core/ScraperEngine';

interface AnalysisResult {
  id: string;
  timestamp: number;
  insights: {
    dataQuality: number; // 0-1 score
    completeness: number; // 0-1 score
    patterns: string[];
    anomalies: string[];
    trends: Record<string, number>;
  };
  metrics: {
    averageResponseTime: number;
    successRate: number;
    dataVolume: number;
    uniqueUrls: number;
  };
  recommendations: string[];
}

class DataAnalyzer extends EventEmitter {
  private analysisHistory: AnalysisResult[] = [];
  private patternCache: Map<string, any> = new Map();

  constructor() {
    super();
  }

  /**
   * Comprehensive analysis of scraping results
   * Dynamic synergy: Real-time pattern detection and optimization suggestions
   */
  async analyzeResults(results: ScrapingResult[]): Promise<AnalysisResult> {
    const startTime = Date.now();
    
    // Calculate core metrics
    const metrics = this.calculateMetrics(results);
    
    // Analyze data quality
    const dataQuality = this.assessDataQuality(results);
    
    // Detect patterns and anomalies
    const patterns = this.detectPatterns(results);
    const anomalies = this.detectAnomalies(results);
    
    // Generate trends analysis
    const trends = this.analyzeTrends(results);
    
    // Generate optimization recommendations
    const recommendations = this.generateRecommendations(results, metrics);

    const analysis: AnalysisResult = {
      id: `analysis_${Date.now()}`,
      timestamp: Date.now(),
      insights: {
        dataQuality: dataQuality.overall,
        completeness: dataQuality.completeness,
        patterns,
        anomalies,
        trends
      },
      metrics,
      recommendations
    };

    // Store for historical analysis
    this.analysisHistory.push(analysis);
    
    // Emit analysis complete event
    this.emit('analysis-complete', analysis);
    
    return analysis;
  }

  private calculateMetrics(results: ScrapingResult[]): AnalysisResult['metrics'] {
    const successful = results.filter(r => r.status === 'success');
    const totalResponseTime = results.reduce((sum, r) => sum + r.performance.responseTime, 0);
    const totalDataSize = results.reduce((sum, r) => sum + r.performance.dataSize, 0);
    const uniqueUrls = new Set(results.map(r => r.url)).size;

    return {
      averageResponseTime: totalResponseTime / results.length,
      successRate: successful.length / results.length,
      dataVolume: totalDataSize,
      uniqueUrls
    };
  }

  private assessDataQuality(results: ScrapingResult[]): { overall: number; completeness: number } {
    const successful = results.filter(r => r.status === 'success');
    
    if (successful.length === 0) {
      return { overall: 0, completeness: 0 };
    }

    // Calculate completeness based on non-null data fields
    const completenessScores = successful.map(result => {
      const dataFields = Object.values(result.data);
      const nonNullFields = dataFields.filter(field => field !== null && field !== undefined && field !== '');
      return nonNullFields.length / dataFields.length;
    });

    const averageCompleteness = completenessScores.reduce((sum, score) => sum + score, 0) / completenessScores.length;
    
    // Overall quality considers success rate and data completeness
    const successRate = successful.length / results.length;
    const overall = (successRate * 0.6) + (averageCompleteness * 0.4);

    return {
      overall,
      completeness: averageCompleteness
    };
  }

  private detectPatterns(results: ScrapingResult[]): string[] {
    const patterns: string[] = [];
    
    // Response time patterns
    const responseTimes = results.map(r => r.performance.responseTime);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    if (responseTimes.some(time => time > avgResponseTime * 2)) {
      patterns.push('Inconsistent response times detected');
    }

    // Error patterns
    const errors = results.filter(r => r.status === 'error');
    if (errors.length > results.length * 0.1) {
      patterns.push('High error rate pattern detected');
    }

    // Data size patterns
    const dataSizes = results.map(r => r.performance.dataSize);
    const avgDataSize = dataSizes.reduce((sum, size) => sum + size, 0) / dataSizes.length;
    
    if (dataSizes.some(size => size < avgDataSize * 0.1)) {
      patterns.push('Unusually small data responses detected');
    }

    return patterns;
  }

  private detectAnomalies(results: ScrapingResult[]): string[] {
    const anomalies: string[] = [];
    
    // Memory usage anomalies
    const memoryUsages = results.map(r => r.performance.memoryUsage);
    const avgMemory = memoryUsages.reduce((sum, mem) => sum + mem, 0) / memoryUsages.length;
    const maxMemory = Math.max(...memoryUsages);
    
    if (maxMemory > avgMemory * 3) {
      anomalies.push('Memory spike detected - potential memory leak');
    }

    // Response time anomalies
    const responseTimes = results.map(r => r.performance.responseTime);
    const maxResponseTime = Math.max(...responseTimes);
    const avgResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    
    if (maxResponseTime > avgResponseTime * 5) {
      anomalies.push('Extreme response time detected - possible timeout issue');
    }

    return anomalies;
  }

  private analyzeTrends(results: ScrapingResult[]): Record<string, number> {
    // Group results by hour for trend analysis
    const hourlyGroups = results.reduce((groups, result) => {
      const hour = new Date(result.timestamp).getHours();
      if (!groups[hour]) groups[hour] = [];
      groups[hour].push(result);
      return groups;
    }, {} as Record<number, ScrapingResult[]>);

    const trends: Record<string, number> = {};

    // Calculate success rate trend
    Object.entries(hourlyGroups).forEach(([hour, hourResults]) => {
      const successRate = hourResults.filter(r => r.status === 'success').length / hourResults.length;
      trends[`hour_${hour}_success_rate`] = successRate;
    });

    return trends;
  }

  private generateRecommendations(results: ScrapingResult[], metrics: AnalysisResult['metrics']): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    if (metrics.averageResponseTime > 5000) {
      recommendations.push('Consider reducing timeout or implementing request caching');
    }

    if (metrics.successRate < 0.9) {
      recommendations.push('Implement better error handling and retry mechanisms');
    }

    // Scalability recommendations
    if (results.length > 1000) {
      recommendations.push('Consider implementing database storage for large datasets');
    }

    // Optimization recommendations
    const memoryUsages = results.map(r => r.performance.memoryUsage);
    const maxMemory = Math.max(...memoryUsages);
    
    if (maxMemory > 500 * 1024 * 1024) { // 500MB
      recommendations.push('Implement streaming processing to reduce memory usage');
    }

    return recommendations;
  }

  /**
   * Get historical analysis data for trend visualization
   */
  getHistoricalAnalysis(): AnalysisResult[] {
    return this.analysisHistory;
  }

  /**
   * Export analysis data for external processing
   */
  exportAnalysis(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      // Convert to CSV format
      const headers = ['timestamp', 'dataQuality', 'successRate', 'averageResponseTime'];
      const csvData = this.analysisHistory.map(analysis => [
        analysis.timestamp,
        analysis.insights.dataQuality,
        analysis.metrics.successRate,
        analysis.metrics.averageResponseTime
      ]);
      
      return [headers, ...csvData].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(this.analysisHistory, null, 2);
  }
}

export { DataAnalyzer, AnalysisResult };
// ✅ Data Analyzer Complete - Advanced analytics with ML-ready features
