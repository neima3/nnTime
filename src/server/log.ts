/**
 * Structured logging — production-ready JSON logs.
 * In development, pretty-prints to console.
 * In production, outputs JSON for log aggregation.
 */
import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";

function shouldLog(level: LogLevel): boolean {
  const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const min = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug")) as LogLevel;
  return levels[level] >= levels[min];
}

export function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  if (process.env.NODE_ENV === "production") {
    console[level === "debug" ? "log" : level](JSON.stringify(entry));
  } else {
    const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : level === "info" ? "ℹ️" : "🔍";
    console[level === "debug" ? "log" : level](prefix, msg, meta ?? "");
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
};
