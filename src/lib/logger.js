/**
 * logger.js - Structured logging utility
 *
 * Implements:
 * - FR-037: Server lifecycle events (start, stop, errors)
 * - FR-038: Database query logging with timing
 * - FR-039: User action logging (tick callback, review ad call)
 *
 * All logs are JSON-formatted for easy parsing and analysis
 */

/**
 * Log levels
 */
export const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Base logger function
 *
 * @param {string} level - Log level
 * @param {string} category - Log category (server, db, user, etc.)
 * @param {string} message - Log message
 * @param {Object} [metadata={}] - Additional structured data
 */
function log(level, category, message, metadata = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...metadata,
  };

  const output = JSON.stringify(logEntry);

  if (level === LogLevel.ERROR) {
    console.error(output);
  } else if (level === LogLevel.WARN) {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * FR-037: Log server lifecycle events
 */
export const server = {
  start: (port, host) => {
    log(LogLevel.INFO, 'server', 'Server started', { port, host });
  },

  stop: (signal) => {
    log(LogLevel.INFO, 'server', 'Server stopped', { signal });
  },

  error: (error, context = {}) => {
    log(LogLevel.ERROR, 'server', 'Server error', {
      error: error.message,
      stack: error.stack,
      ...context,
    });
  },
};

/**
 * FR-038: Log database queries with timing
 */
export const db = {
  /**
   * Log a database query with execution time
   *
   * @param {string} dbName - Database name (comms, reviews)
   * @param {string} operation - SQL operation (SELECT, INSERT, UPDATE, etc.)
   * @param {number} durationMs - Query duration in milliseconds
   * @param {Object} [metadata={}] - Additional context
   */
  query: (dbName, operation, durationMs, metadata = {}) => {
    const level = durationMs > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    log(level, 'db', 'Database query', {
      db: dbName,
      operation,
      duration_ms: durationMs,
      ...metadata,
    });
  },

  error: (dbName, error, context = {}) => {
    log(LogLevel.ERROR, 'db', 'Database error', {
      db: dbName,
      error: error.message,
      ...context,
    });
  },

  connect: (dbName, path) => {
    log(LogLevel.INFO, 'db', 'Database connected', { db: dbName, path });
  },

  close: (dbName) => {
    log(LogLevel.INFO, 'db', 'Database closed', { db: dbName });
  },
};

/**
 * FR-039: Log user actions
 */
export const user = {
  /**
   * Log callback tick action (Tab 1)
   *
   * @param {string} callerNumber - Caller phone number (masked)
   * @param {string} outcome - Callback outcome
   * @param {string|null} notes - Optional notes
   */
  tickCallback: (callerNumber, outcome, notes = null) => {
    log(LogLevel.INFO, 'user', 'Callback ticked', {
      action: 'tick_callback',
      caller_number: callerNumber,
      outcome,
      has_notes: notes !== null && notes !== '',
    });
  },

  /**
   * Log ad call review action (Tab 2)
   *
   * @param {number} adCallId - Ad call ID
   * @param {string} decision - Review decision
   * @param {string|null} notes - Optional notes
   */
  reviewAdCall: (adCallId, decision, notes = null) => {
    log(LogLevel.INFO, 'user', 'Ad call reviewed', {
      action: 'review_ad_call',
      ad_call_id: adCallId,
      decision,
      has_notes: notes !== null && notes !== '',
    });
  },

  /**
   * Log filter/sort actions
   *
   * @param {string} tab - Tab name (callbacks, ad-review)
   * @param {string} filter - Filter applied
   */
  filter: (tab, filter) => {
    log(LogLevel.DEBUG, 'user', 'Filter applied', {
      action: 'filter',
      tab,
      filter,
    });
  },
};

/**
 * Log HTTP requests
 */
export const http = {
  request: (method, url, statusCode, durationMs) => {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    log(level, 'http', 'HTTP request', {
      method,
      url,
      status: statusCode,
      duration_ms: durationMs,
    });
  },

  error: (method, url, error) => {
    log(LogLevel.ERROR, 'http', 'HTTP error', {
      method,
      url,
      error: error.message,
    });
  },
};

/**
 * Generic info/warn/error loggers
 */
export const info = (message, metadata = {}) => {
  log(LogLevel.INFO, 'app', message, metadata);
};

export const warn = (message, metadata = {}) => {
  log(LogLevel.WARN, 'app', message, metadata);
};

export const error = (message, error, metadata = {}) => {
  log(LogLevel.ERROR, 'app', message, {
    error: error?.message,
    stack: error?.stack,
    ...metadata,
  });
};

/**
 * Timer utility for measuring operation duration
 *
 * @returns {Function} Function that returns elapsed time in ms
 */
export function timer() {
  const start = Date.now();
  return () => Date.now() - start;
}
