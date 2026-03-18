import type { Request, Response, NextFunction } from 'express';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

// Create a custom registry for API metrics
export const metricsRegistry = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: metricsRegistry });

// API request counter per endpoint
export const apiRequestsTotal = new Counter({
  name: 'api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['endpoint', 'method', 'status'],
  registers: [metricsRegistry],
});

// API request duration histogram
export const apiRequestDuration = new Histogram({
  name: 'api_request_duration_seconds',
  help: 'Duration of API requests in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * Express middleware for request metrics tracking
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/health' || req.path === '/metrics' || req.method === 'OPTIONS') {
      return next();
    }

    const startTime = Date.now();
    const endpoint = req.path;
    const method = req.method;

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      apiRequestDuration.labels(endpoint, method).observe(duration);
      apiRequestsTotal.labels(endpoint, method, String(res.statusCode)).inc();
    });

    next();
  };
}

/**
 * Get metrics endpoint handler
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}
