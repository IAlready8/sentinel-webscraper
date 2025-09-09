/**
 * IMPLEMENTATION PLAN:
 * 1. Design streaming data pipeline with real-time processing
 * 2. Implement data transformation and validation layers
 * 3. Add multiple output adapters (JSON, CSV, Database, API)
 * 4. Create data quality monitoring and alerting system
 * 5. Build incremental data synchronization capabilities
 */

import { EventEmitter } from 'events';
import { Transform, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import chalk from 'chalk';
import csvWriter from 'csv-writer';
import JSONStream from 'JSONStream';

const pipelineAsync = promisify(pipeline);

// ✅ Core Types and Schemas
export interface DataRecord {
  id: string;
  source: string;
  timestamp: number;
  data: Record<string, any>;
  metadata: {
    quality: number; // 0-1 quality score
    confidence: number; // 0-1 confidence score
    tags: string[];
    version: string;
  };
}

export interface PipelineConfig {
  outputFormats: ('json' | 'csv' | 'database' | 'api')[];
  outputDirectory: string;
  enableValidation: boolean;
  enableTransformation: boolean;
  batchSize: number;
  flushInterval: number;
  qualityThreshold: number;
  enableDeduplication: boolean;
  enableIncremental: boolean;
}

export interface TransformationRule {
  field: string;
  operation: 'clean' | 'normalize' | 'extract' | 'convert' | 'validate';
  params?: Record<string, any>;
}

export interface ValidationRule {
  field: string;
  schema: z.ZodSchema;
  required: boolean;
  errorAction: 'skip' | 'fix' | 'alert';
}

// ✅ Data Quality Analyzer
class DataQualityAnalyzer {
  private static calculateQualityScore(data: Record<string, any>): number {
    let score = 1.0;
    let checks = 0;

    for (const [key, value] of Object.entries(data)) {
      checks++;
      
      // Null/undefined penalty
      if (value === null || value === undefined) {
        score -= 0.2;
        continue;
      }

      // Empty string penalty
      if (typeof value === 'string' && value.trim().length === 0) {
        score -= 0.15;
        continue;
      }

      // Data type consistency
      if (typeof value === 'string') {
        // Check for common data issues
        if (value.includes('undefined') || value.includes('null')) {
          score -= 0.1;
        }
        
        // Reward clean text
        if (value.length > 3 && !value.includes('...')) {
          score += 0.05;
        }
      }

      // Array completeness
      if (Array.isArray(value)) {
        if (value.length === 0) {
          score -= 0.1;
        } else if (value.length > 0) {
          score += 0.05;
        }
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  public static analyzeRecord(record: DataRecord): DataRecord {
    const qualityScore = this.calculateQualityScore(record.data);
    
    record.metadata.quality = qualityScore;
    record.metadata.confidence = qualityScore > 0.8 ? 0.9 : qualityScore * 0.7;
    
    // Add quality tags
    if (qualityScore > 0.9) {
      record.metadata.tags.push('high-quality');
    } else if (qualityScore < 0.5) {
      record.metadata.tags.push('low-quality');
    }

    return record;
  }
}

// ✅ Stream-Based Data Transformer
class DataTransformStream extends Transform {
  private rules: TransformationRule[];

  constructor(rules: TransformationRule[]) {
    super({ objectMode: true });
    this.rules = rules;
  }

  _transform(record: DataRecord, encoding: string, callback: Function) {
    try {
      // Apply transformation rules
      for (const rule of this.rules) {
        record.data = this.applyTransformation(record.data, rule);
      }

      // Analyze data quality
      record = DataQualityAnalyzer.analyzeRecord(record);

      callback(null, record);
    } catch (error) {
      console.error(chalk.red(`❌ Transformation error: ${error}`));
      callback(error);
    }
  }

  private applyTransformation(data: Record<string, any>, rule: TransformationRule): Record<string, any> {
    const { field, operation, params = {} } = rule;
    
    if (!(field in data)) return data;

    const value = data[field];

    switch (operation) {
      case 'clean':
        if (typeof value === 'string') {
          data[field] = value
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[^\w\s\-.,!?]/g, '');
        }
        break;

      case 'normalize':
        if (typeof value === 'string') {
          data[field] = value.toLowerCase().trim();
        }
        break;

      case 'extract':
        if (typeof value === 'string' && params.regex) {
          const match = value.match(new RegExp(params.regex));
          data[field] = match ? match[0] : null;
        }
        break;

      case 'convert':
        if (params.to === 'number' && typeof value === 'string') {
          const num = parseFloat(value.replace(/[^\d.-]/g, ''));
          data[field] = isNaN(num) ? null : num;
        } else if (params.to === 'date' && typeof value === 'string') {
          const date = new Date(value);
          data[field] = isNaN(date.getTime()) ? null : date.toISOString();
        }
        break;

      case 'validate':
        // Validation logic will be handled separately
        break;
    }

    return data;
  }
}

// ✅ Data Validation Stream
class DataValidationStream extends Transform {
  private rules: ValidationRule[];
  private errorCount = 0;

  constructor(rules: ValidationRule[]) {
    super({ objectMode: true });
    this.rules = rules;
  }

  _transform(record: DataRecord, encoding: string, callback: Function) {
    try {
      const validationResults = this.validateRecord(record);
      
      if (validationResults.isValid) {
        record.metadata.tags.push('validated');
        callback(null, record);
      } else {
        this.errorCount++;
        
        // Handle validation errors based on rules
        const shouldSkip = validationResults.errors.some(error => 
          this.rules.find(rule => rule.field === error.field)?.errorAction === 'skip'
        );

        if (shouldSkip) {
          console.warn(chalk.yellow(`⚠️ Skipping invalid record: ${record.id}`));
          callback(); // Skip this record
        } else {
          record.metadata.tags.push('validation-errors');
          callback(null, record);
        }
      }
    } catch (error) {
      callback(error);
    }
  }

  private validateRecord(record: DataRecord): { isValid: boolean; errors: any[] } {
    const errors: any[] = [];

    for (const rule of this.rules) {
      const { field, schema, required } = rule;
      
      if (required && !(field in record.data)) {
        errors.push({ field, error: 'Required field missing' });
        continue;
      }

      if (field in record.data) {
        const result = schema.safeParse(record.data[field]);
        if (!result.success) {
          errors.push({ field, error: result.error.message });
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  public getErrorCount(): number {
    return this.errorCount;
  }
}

// ✅ Multi-Format Output Manager
class OutputManager {
  private config: PipelineConfig;
  private writers: Map<string, any> = new Map();

  constructor(config: PipelineConfig) {
    this.config = config;
    this.initializeWriters();
  }

  private async initializeWriters(): Promise<void> {
    // Ensure output directory exists
    if (!existsSync(this.config.outputDirectory)) {
      await mkdir(this.config.outputDirectory, { recursive: true });
    }

    // Initialize CSV writer if needed
    if (this.config.outputFormats.includes('csv')) {
      const csvPath = join(this.config.outputDirectory, 'scraped_data.csv');
      const writer = csvWriter.createObjectCsvWriter({
        path: csvPath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'source', title: 'Source' },
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'data', title: 'Data' },
          { id: 'quality', title: 'Quality Score' },
        ],
      });
      this.writers.set('csv', writer);
    }
  }

  public async writeRecord(record: DataRecord): Promise<void> {
    const promises: Promise<void>[] = [];

    // JSON output
    if (this.config.outputFormats.includes('json')) {
      promises.push(this.writeJSON(record));
    }

    // CSV output
    if (this.config.outputFormats.includes('csv')) {
      promises.push(this.writeCSV(record));
    }

    // Database output
    if (this.config.outputFormats.includes('database')) {
      promises.push(this.writeDatabase(record));
    }

    // API output
    if (this.config.outputFormats.includes('api')) {
      promises.push(this.writeAPI(record));
    }

    await Promise.all(promises);
  }

  private async writeJSON(record: DataRecord): Promise<void> {
    const filePath = join(this.config.outputDirectory, 'scraped_data.jsonl');
    const line = JSON.stringify(record) + '\n';
    await appendFile(filePath, line);
  }

  private async writeCSV(record: DataRecord): Promise<void> {
    const writer = this.writers.get('csv');
    if (writer) {
      await writer.writeRecords([{
        id: record.id,
        source: record.source,
        timestamp: new Date(record.timestamp).toISOString(),
        data: JSON.stringify(record.data),
        quality: record.metadata.quality.toFixed(2),
      }]);
    }
  }

  private async writeDatabase(record: DataRecord): Promise<void> {
    // TODO: scalability - implement database adapter
    console.log(chalk.blue('📊 Database write: '), record.id);
  }

  private async writeAPI(record: DataRecord): Promise<void> {
    // TODO: optimization - implement API webhook
    console.log(chalk.green('🌐 API write: '), record.id);
  }
}

// ✅ Main Data Pipeline Manager
export class DataPipelineManager extends EventEmitter {
  private config: PipelineConfig;
  private outputManager: OutputManager;
  private transformationRules: TransformationRule[] = [];
  private validationRules: ValidationRule[] = [];
  private recordBuffer: DataRecord[] = [];
  private flushTimer?: NodeJS.Timer;
  private processedCount = 0;
  private deduplicationCache = new Set<string>();

  constructor(config: Partial<PipelineConfig> = {}) {
    super();

    this.config = {
      outputFormats: ['json'],
      outputDirectory: './data/output',
      enableValidation: true,
      enableTransformation: true,
      batchSize: 100,
      flushInterval: 5000,
      qualityThreshold: 0.5,
      enableDeduplication: true,
      enableIncremental: true,
      ...config,
    };

    this.outputManager = new OutputManager(this.config);
    this.setupFlushTimer();
  }

  // ✅ Configure Transformation Rules
  public addTransformationRule(rule: TransformationRule): void {
    this.transformationRules.push(rule);
    console.log(chalk.blue(`🔧 Added transformation rule for field: ${rule.field}`));
  }

  // ✅ Configure Validation Rules
  public addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule);
    console.log(chalk.blue(`✅ Added validation rule for field: ${rule.field}`));
  }

  // ✅ Process Single Record
  public async processRecord(data: Record<string, any>, source: string): Promise<void> {
    const record: DataRecord = {
      id: this.generateRecordId(data, source),
      source,
      timestamp: Date.now(),
      data,
      metadata: {
        quality: 0,
        confidence: 0,
        tags: [],
        version: '1.0',
      },
    };

    // Deduplication check
    if (this.config.enableDeduplication) {
      if (this.deduplicationCache.has(record.id)) {
        console.log(chalk.yellow(`⚠️ Duplicate record skipped: ${record.id}`));
        return;
      }
      this.deduplicationCache.add(record.id);
    }

    await this.processRecordThroughPipeline(record);
  }

  // ✅ Stream Processing Pipeline
  private async processRecordThroughPipeline(record: DataRecord): Promise<void> {
    try {
      // Create transformation stream
      const transformStream = new DataTransformStream(this.transformationRules);
      
      // Create validation stream
      const validationStream = new DataValidationStream(this.validationRules);
      
      // Create output stream
      const outputStream = new Writable({
        objectMode: true,
        write: async (record: DataRecord, encoding, callback) => {
          // Quality filter
          if (record.metadata.quality >= this.config.qualityThreshold) {
            this.recordBuffer.push(record);
            
            // Flush if buffer is full
            if (this.recordBuffer.length >= this.config.batchSize) {
              await this.flushBuffer();
            }
          } else {
            console.warn(chalk.yellow(`⚠️ Record below quality threshold: ${record.id}`));
          }
          
          callback();
        },
      });

      // Process record through pipeline
      await new Promise<void>((resolve, reject) => {
        const stream = transformStream
          .pipe(validationStream)
          .pipe(outputStream);

        stream.on('finish', resolve);
        stream.on('error', reject);

        transformStream.write(record);
        transformStream.end();
      });

      this.processedCount++;
      this.emit('record:processed', record);

    } catch (error) {
      console.error(chalk.red(`❌ Pipeline processing error: ${error}`));
      this.emit('record:error', { record, error });
    }
  }

  // ✅ Batch Processing
  public async processBatch(records: Array<{ data: Record<string, any>; source: string }>): Promise<void> {
    console.log(chalk.blue(`🔄 Processing batch of ${records.length} records`));

    const promises = records.map(({ data, source }) => 
      this.processRecord(data, source)
    );

    await Promise.allSettled(promises);
    await this.flushBuffer(); // Ensure all data is written

    console.log(chalk.green(`✅ Batch processing complete`));
  }

  // ✅ Buffer Management
  private setupFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.recordBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, this.config.flushInterval);
  }

  private async flushBuffer(): Promise<void> {
    if (this.recordBuffer.length === 0) return;

    const recordsToFlush = [...this.recordBuffer];
    this.recordBuffer = [];

    console.log(chalk.blue(`💾 Flushing ${recordsToFlush.length} records to output`));

    try {
      await Promise.all(
        recordsToFlush.map(record => this.outputManager.writeRecord(record))
      );

      this.emit('batch:flushed', { count: recordsToFlush.length });
    } catch (error) {
      console.error(chalk.red(`❌ Buffer flush error: ${error}`));
      this.emit('batch:error', error);
    }
  }

  // ✅ Utility Methods
  private generateRecordId(data: Record<string, any>, source: string): string {
    const dataHash = this.simpleHash(JSON.stringify(data));
    return `${source}_${dataHash}_${Date.now()}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ✅ Analytics and Monitoring
  public getProcessingStats(): Record<string, any> {
    return {
      processedRecords: this.processedCount,
      bufferSize: this.recordBuffer.length,
      deduplicationCacheSize: this.deduplicationCache.size,
      transformationRules: this.transformationRules.length,
      validationRules: this.validationRules.length,
      uptime: process.uptime(),
    };
  }

  // ✅ Graceful Shutdown
  public async shutdown(): Promise<void> {
    console.log(chalk.yellow('🛑 Shutting down data pipeline...'));

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush remaining data
    await this.flushBuffer();

    console.log(chalk.green('✅ Data pipeline shutdown complete'));
  }
}

// ✅ Export for integration
export default DataPipelineManager;
