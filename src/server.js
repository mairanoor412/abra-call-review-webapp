import http from 'node:http';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getCommsDb, closeCommsDb, verifySchema } from './db/comms.js';
import { getReviewsDb, closeReviewsDb } from './db/reviews.js';
import { callbackWorklistRouter } from './routes/callback-worklist.js';
import { adReviewRouter } from './routes/ad-review.js';
import * as logger from './lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 7000;
const HOST = '127.0.0.1';

// Initialize databases on startup
function initializeDatabases() {
  try {
    const commsDb = getCommsDb();
    verifySchema();
    const reviewsDb = getReviewsDb();
    console.log('[server] Database initialization complete');
    return { commsDb, reviewsDb };
  } catch (error) {
    console.error('[server] Database initialization failed:', error.message);
    throw error;
  }
}

// Create HTTP server (exported for testing)
export function createHttpServer() {
  initializeDatabases();

  return http.createServer((req, res) => {
  // API routes
  if (req.url.startsWith('/api/callbacks')) {
    return callbackWorklistRouter(req, res);
  }

  if (req.url.startsWith('/api/ad-calls')) {
    return adReviewRouter(req, res);
  }

  // Static files
  if (req.method === 'GET' && req.url === '/styles.css') {
    try {
      const css = readFileSync(join(__dirname, 'public/styles.css'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/css' });
      res.end(css);
    } catch (error) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('CSS not found');
    }
    return;
  }

  // Page routes
  if (req.method === 'GET' && (req.url === '/' || req.url === '/callbacks')) {
    try {
      const html = readFileSync(join(__dirname, 'views/index.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading page');
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
  });
}

// Start server
const server = createHttpServer();

server.listen(PORT, HOST, () => {
  logger.server.start(PORT, HOST);  // FR-037: Log server startup
  console.log(`Server running at http://${HOST}:${PORT}/`);
  console.log(`Press Ctrl+C to stop`);
});

// Graceful shutdown
function shutdown(signal) {
  logger.server.stop(signal);  // FR-037: Log server shutdown
  console.log(`${signal} received, shutting down gracefully...`);
  server.close(() => {
    closeCommsDb();
    closeReviewsDb();
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
