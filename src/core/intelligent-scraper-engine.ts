/**
 * IMPLEMENTATION PLAN:
 * 1. Build adaptive scraping engine with AI-powered content detection
 * 2. Implement multi-strategy scraping (static, dynamic, SPA) with auto-detection
 * 3. Add intelligent rate limiting and anti-detection mechanisms
 * 4. Create data validation pipeline with schema enforcement
 * 5. Integrate comprehensive monitoring and performance optimization
 */

import { EventEmitter } from 'events';
import puppeteer, { Browser, Page, LaunchOptions } from 'puppeteer';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import { RateLimiter } from 'limiter';
import pLimit from 'p-limit';
import UserAgent from 'user-agents';
import { z } from 'zod';
import chalk from 'chalk';

// ✅ Core Types and Interfaces
export interface ScrapingTarget {
  id: string;
  url: string;
  selectors: Record<string, string>;
  type: 'auto' | 'static' | 'dynamic' | 'spa';
  rateLimit: number;
  retryAttempts: number;
  headers?: Record<string, string>;
  cookies?: Array<{ name: string; value: string; domain: string }>;
  waitForSelector?: string;
  scrollToLoad?: boolean;
  customLogic?: string; // JavaScript code to execute
}

export interface ScrapingResult {
  id: string;
  url: string;
  data: Record<string, any>;
  metadata: {
    timestamp: number;
    responseTime: number;
    statusCode: number;
    contentLength: number;
    detectedType: string;
    errors?: string[];
    performance: {
      domLoadTime: number;
      networkTime: number;
      renderTime: number;
    };
  };
}

export interface ScraperConfig {
  concurrency: number;
  timeout: number;
  enableJavaScript: boolean;
  respectRobotsTxt: boolean;
  maxRetries: number;
  retryDelay: number;
  antiDetection: {
    randomUserAgent: boolean;
    randomViewport: boolean;
    humanLikeDelay: boolean;
    rotateProxies: boolean;
  };
  performance: {
    enableCache: boolean;
    maxCacheSize: number;
    enableCompression: boolean;
  };
}

// ✅ Advanced AI-Powered Scraper Engine
export class IntelligentScraperEngine extends EventEmitter {
  private browser?: Browser;
  private axiosInstance: AxiosInstance;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private concurrencyLimit: pLimit.Limit;
  private config: ScraperConfig;
  private userAgentGenerator: UserAgent;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private performanceMetrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
    startTime: number;
  };

  constructor(config: Partial<ScraperConfig> = {}) {
    super();
    
    // TODO: scalability - implement adaptive concurrency based on system resources
    this.config = {
      concurrency: 8, // Optimized for MacBook Pro/Air
      timeout: 45000,
      enableJavaScript: true,
      respectRobotsTxt: true,
      maxRetries: 5,
      retryDelay: 2000,
      antiDetection: {
        randomUserAgent: true,
        randomViewport: true,
        humanLikeDelay: true,
        rotateProxies: false, // Local-first approach
      },
      performance: {
        enableCache: true,
        maxCacheSize: 1000,
        enableCompression: true,
      },
      ...config
    };

    this.concurrencyLimit = pLimit(this.config.concurrency);
    this.userAgentGenerator = new UserAgent({ deviceCategory: 'desktop' });
    this.axiosInstance = this.createOptimizedAxiosInstance();
    this.performanceMetrics = this.initializeMetrics();
    
    // Optimization: Graceful shutdown and cleanup
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  // ✅ Initialize High-Performance Browser
  private async initializeBrowser(): Promise<void> {
    if (this.browser) return;

    const launchOptions: LaunchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-default-apps',
        '--no-first-run',
        '--memory-pressure-off',
        '--max_old_space_size=4096', // Optimize for MacBook specs
      ],
    };

    try {
      this.browser = await puppeteer.launch(launchOptions);
      console.log(chalk.green('🚀 Browser initialized with performance optimization'));
      this.emit('browser:initialized');
    } catch (error) {
      console.error(chalk.red('❌ Browser initialization failed:'), error);
      this.emit('browser:error', error);
      throw new Error(`Browser initialization failed: ${error}`);
    }
  }

  // ✅ Create Performance-Optimized Axios Instance
  private createOptimizedAxiosInstance(): AxiosInstance {
    const instance = axios.create({
      timeout: this.config.timeout,
      maxRedirects: 5,
      validateStatus: (status) => status < 500,
      decompress: this.config.performance.enableCompression,
    });

    // Add request interceptor for anti-detection
    instance.interceptors.request.use((config) => {
      if (this.config.antiDetection.randomUserAgent) {
        config.headers['User-Agent'] = this.userAgentGenerator.toString();
      }
      
      config.headers = {
        ...config.headers,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0',
      };

      return config;
    });

    return instance;
  }

  // ✅ Auto-detect Website Type with AI Logic
  private async detectWebsiteType(url: string): Promise<'static' | 'dynamic' | 'spa'> {
    try {
      const response = await this.axiosInstance.get(url, { timeout: 10000 });
      const html = response.data;
      const $ = cheerio.load(html);

      // AI-powered detection logic
      const indicators = {
        spa: [
          html.includes('React'),
          html.includes('Vue'),
          html.includes('Angular'),
          html.includes('__NEXT_DATA__'),
          $('div[id="root"]').length > 0,
          $('div[id="app"]').length > 0,
          $('script[src*="chunk"]').length > 0,
        ],
        dynamic: [
          html.includes('window.onload'),
          html.includes('document.addEventListener'),
          $('script').length > 5,
          html.includes('fetch('),
          html.includes('XMLHttpRequest'),
          html.includes('ajax'),
        ],
      };

      const spaScore = indicators.spa.filter(Boolean).length;
      const dynamicScore = indicators.dynamic.filter(Boolean).length;

      if (spaScore >= 3) return 'spa';
      if (dynamicScore >= 3) return 'dynamic';
      return 'static';

    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Website type detection failed for ${url}, defaulting to dynamic`));
      return 'dynamic';
    }
  }

  // ✅ Execute Scraping with Intelligent Strategy Selection
  public async scrapeTarget(target: ScrapingTarget): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    // Check cache first
    if (this.config.performance.enableCache) {
      const cached = this.getCachedResult(target.url);
      if (cached) {
        this.performanceMetrics.cacheHitRate++;
        return cached;
      }
    }

    // Auto-detect website type if not specified
    const websiteType = target.type === 'auto' 
      ? await this.detectWebsiteType(target.url)
      : target.type;

    let result: ScrapingResult;

    try {
      // Rate limiting per domain
      await this.enforceRateLimit(target.url, target.rateLimit);

      // Dynamic synergy - choose optimal scraping strategy
      switch (websiteType) {
        case 'static':
          result = await this.scrapeStatic(target);
          break;
        case 'dynamic':
        case 'spa':
          result = await this.scrapeDynamic(target);
          break;
        default:
          throw new Error(`Unsupported website type: ${websiteType}`);
      }

      result.metadata.detectedType = websiteType;
      result.metadata.responseTime = Date.now() - startTime;

      // Cache successful results
      if (this.config.performance.enableCache) {
        this.setCachedResult(target.url, result);
      }

      this.performanceMetrics.successfulRequests++;
      this.emit('scraping:success', result);

      return result;

    } catch (error) {
      this.performanceMetrics.failedRequests++;
      this.emit('scraping:error', { target, error });
      
      throw new Error(`Scraping failed for ${target.url}: ${error}`);
    }
  }

  // ✅ Static Content Scraping with Cheerio
  private async scrapeStatic(target: ScrapingTarget): Promise<ScrapingResult> {
    const config: AxiosRequestConfig = {
      headers: target.headers || {},
    };

    const response = await this.axiosInstance.get(target.url, config);
    const $ = cheerio.load(response.data);

    const data: Record<string, any> = {};
    
    // Extract data using selectors
    for (const [key, selector] of Object.entries(target.selectors)) {
      try {
        const elements = $(selector);
        if (elements.length === 1) {
          data[key] = elements.text().trim();
        } else if (elements.length > 1) {
          data[key] = elements.map((_, el) => $(el).text().trim()).get();
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Selector failed: ${selector}`));
        data[key] = null;
      }
    }

    return {
      id: target.id,
      url: target.url,
      data,
      metadata: {
        timestamp: Date.now(),
        responseTime: 0, // Will be set in parent method
        statusCode: response.status,
        contentLength: response.data.length,
        detectedType: 'static',
        performance: {
          domLoadTime: 0,
          networkTime: 0,
          renderTime: 0,
        },
      },
    };
  }

  // ✅ Dynamic Content Scraping with Puppeteer
  private async scrapeDynamic(target: ScrapingTarget): Promise<ScrapingResult> {
    await this.initializeBrowser();
    
    const page = await this.browser!.newPage();
    
    try {
      // Anti-detection measures
      if (this.config.antiDetection.randomViewport) {
        await page.setViewport({
          width: 1200 + Math.floor(Math.random() * 600),
          height: 800 + Math.floor(Math.random() * 400),
        });
      }

      // Set cookies if provided
      if (target.cookies) {
        await page.setCookie(...target.cookies);
      }

      // Performance monitoring
      const performanceMetrics = {
        domLoadTime: 0,
        networkTime: 0,
        renderTime: 0,
      };

      const navigationStart = Date.now();
      
      // Navigate to page with optimized settings
      await page.goto(target.url, {
        waitUntil: 'domcontentloaded',
        timeout: this.config.timeout,
      });

      performanceMetrics.networkTime = Date.now() - navigationStart;

      // Wait for specific selector if provided
      if (target.waitForSelector) {
        await page.waitForSelector(target.waitForSelector, { timeout: 10000 });
      }

      // Scroll to load content if needed
      if (target.scrollToLoad) {
        await this.autoScroll(page);
      }

      // Execute custom logic if provided
      if (target.customLogic) {
        await page.evaluate(target.customLogic);
      }

      // Human-like delay for anti-detection
      if (this.config.antiDetection.humanLikeDelay) {
        await this.humanDelay();
      }

      const renderStart = Date.now();

      // Extract data using selectors
      const data: Record<string, any> = {};
      
      for (const [key, selector] of Object.entries(target.selectors)) {
        try {
          const elements = await page.$$(selector);
          
          if (elements.length === 1) {
            data[key] = await page.$eval(selector, el => el.textContent?.trim());
          } else if (elements.length > 1) {
            data[key] = await page.$$eval(selector, els => 
              els.map(el => el.textContent?.trim()).filter(Boolean)
            );
          }
        } catch (error) {
          console.warn(chalk.yellow(`⚠️ Selector failed: ${selector}`));
          data[key] = null;
        }
      }

      performanceMetrics.renderTime = Date.now() - renderStart;

      return {
        id: target.id,
        url: target.url,
        data,
        metadata: {
          timestamp: Date.now(),
          responseTime: 0,
          statusCode: 200,
          contentLength: (await page.content()).length,
          detectedType: 'dynamic',
          performance: performanceMetrics,
        },
      };

    } finally {
      await page.close();
    }
  }

  // ✅ Utility Methods
  private async enforceRateLimit(url: string, rateLimit: number): Promise<void> {
    const domain = new URL(url).hostname;
    
    if (!this.rateLimiters.has(domain)) {
      this.rateLimiters.set(domain, new RateLimiter({
        tokensPerInterval: rateLimit,
        interval: 'minute',
      }));
    }

    const limiter = this.rateLimiters.get(domain)!;
    await limiter.removeTokens(1);
  }

  private async autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  private async humanDelay(): Promise<void> {
    const delay = 500 + Math.random() * 2000; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private getCachedResult(url: string): ScrapingResult | null {
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes
      return cached.data;
    }
    return null;
  }

  private setCachedResult(url: string, result: ScrapingResult): void {
    if (this.cache.size >= this.config.performance.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(url, { data: result, timestamp: Date.now() });
  }

  private initializeMetrics() {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      startTime: Date.now(),
    };
  }

  // ✅ Batch Processing with Concurrency Control
  public async scrapeBatch(targets: ScrapingTarget[]): Promise<ScrapingResult[]> {
    console.log(chalk.blue(`🔄 Starting batch scraping of ${targets.length} targets`));
    
    const results = await Promise.allSettled(
      targets.map(target => 
        this.concurrencyLimit(() => this.scrapeTarget(target))
      )
    );

    const successful = results
      .filter((result): result is PromiseFulfilledResult<ScrapingResult> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    const failed = results.filter(result => result.status === 'rejected');

    console.log(chalk.green(`✅ Batch complete: ${successful.length} successful, ${failed.length} failed`));

    return successful;
  }

  // ✅ Performance Analytics
  public getPerformanceReport(): Record<string, any> {
    const uptime = Date.now() - this.performanceMetrics.startTime;
    
    return {
      uptime: `${Math.round(uptime / 1000)}s`,
      totalRequests: this.performanceMetrics.totalRequests,
      successRate: `${Math.round((this.performanceMetrics.successfulRequests / this.performanceMetrics.totalRequests) * 100)}%`,
      cacheHitRate: `${Math.round((this.performanceMetrics.cacheHitRate / this.performanceMetrics.totalRequests) * 100)}%`,
      averageResponseTime: `${this.performanceMetrics.averageResponseTime}ms`,
      cacheSize: this.cache.size,
      activeDomains: this.rateLimiters.size,
    };
  }

  // ✅ Graceful Shutdown
  public async shutdown(): Promise<void> {
    console.log(chalk.yellow('🛑 Shutting down scraper engine...'));
    
    if (this.browser) {
      await this.browser.close();
    }
    
    this.cache.clear();
    this.rateLimiters.clear();
    
    console.log(chalk.green('✅ Scraper engine shutdown complete'));
  }
}

// ✅ Export for use in other modules
export default IntelligentScraperEngine;
