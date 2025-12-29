import type { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Create a custom registry for API metrics
export const metricsRegistry = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: metricsRegistry });

// API request counter per API key and endpoint
export const apiRequestsTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['api_key', 'endpoint', 'method', 'status'],
  registers: [metricsRegistry],
});

// API request duration histogram
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['api_key', 'endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// Rate limit exceeded counter
export const rateLimitExceeded = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['api_key', 'endpoint'],
  registers: [metricsRegistry],
});

// In-memory rate limiting store
interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Rate limit configuration per API key
export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Maximum requests per window
}

export interface ApiKeyConfig {
  apiKeys: Set<string>;
  enabled: boolean;
  rateLimit: RateLimitConfig;
}

// Default configuration
const defaultRateLimit: RateLimitConfig = {
  windowMs: 60000,      // 1 minute
  maxRequests: 100,     // 100 requests per minute
};

/**
 * Parse API keys from environment variable
 * Format: comma-separated list of API keys
 */
export function parseApiKeys(envValue: string | undefined): Set<string> {
  if (!envValue) return new Set();
  return new Set(
    envValue
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0)
  );
}

/**
 * Get API key configuration from environment
 */
export function getApiKeyConfig(): ApiKeyConfig {
  const enabled = process.env.ENABLE_API_KEY === 'true';
  const apiKeys = parseApiKeys(process.env.API_KEYS);

  const rateLimit: RateLimitConfig = {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(defaultRateLimit.windowMs), 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || String(defaultRateLimit.maxRequests), 10),
  };

  return { apiKeys, enabled, rateLimit };
}

/**
 * Check if request is within rate limit
 */
function checkRateLimit(apiKey: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  const key = `${apiKey}`;
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > config.windowMs) {
    // Start new window
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= config.maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Clean up expired rate limit entries periodically
 */
export function startRateLimitCleanup(intervalMs: number = 60000): NodeJS.Timeout {
  return setInterval(() => {
    const now = Date.now();
    const config = getApiKeyConfig();

    for (const [key, entry] of rateLimitStore.entries()) {
      if (now - entry.windowStart > config.rateLimit.windowMs) {
        rateLimitStore.delete(key);
      }
    }
  }, intervalMs);
}

// Endpoints that are exempt from rate limiting (but still require API key if enabled)
const RATE_LIMIT_EXEMPT_ENDPOINTS = ['/quote'];

/**
 * Express middleware for API key authentication and rate limiting
 */
export function apiKeyMiddleware(config?: ApiKeyConfig) {
  const finalConfig = config || getApiKeyConfig();

  return (req: Request, res: Response, next: NextFunction) => {
    // Skip middleware entirely for health check and metrics endpoints
    if (req.path === '/health' || req.path === '/metrics') {
      return next();
    }

    const startTime = Date.now();
    const apiKey = req.header('X-API-Key') || 'anonymous';
    const endpoint = req.path;
    const method = req.method;

    // Track request duration on response finish
    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      apiRequestDuration.labels(apiKey, endpoint, method).observe(duration);
      apiRequestsTotal.labels(apiKey, endpoint, method, String(res.statusCode)).inc();
    });

    // If API key auth is disabled, allow all requests
    if (!finalConfig.enabled) {
      return next();
    }

    // Validate API key
    if (!req.header('X-API-Key')) {
      return res.status(401).json({
        success: false,
        error: 'API key required. Please provide X-API-Key header.',
        code: 'UNAUTHORIZED',
      });
    }

    if (!finalConfig.apiKeys.has(apiKey)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'UNAUTHORIZED',
      });
    }

    // Skip rate limiting for exempt endpoints (e.g., /quote)
    if (RATE_LIMIT_EXEMPT_ENDPOINTS.includes(req.path)) {
      return next();
    }

    // Check rate limit
    if (!checkRateLimit(apiKey, finalConfig.rateLimit)) {
      rateLimitExceeded.labels(apiKey, endpoint).inc();

      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMITED',
      });
    }

    next();
  };
}

/**
 * Get metrics endpoint handler
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get current rate limit status for an API key
 */
export function getRateLimitStatus(apiKey: string, config: RateLimitConfig): {
  remaining: number;
  resetAt: number;
} {
  const entry = rateLimitStore.get(apiKey);
  const now = Date.now();

  if (!entry || now - entry.windowStart > config.windowMs) {
    return {
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
    };
  }

  return {
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.windowStart + config.windowMs,
  };
}
