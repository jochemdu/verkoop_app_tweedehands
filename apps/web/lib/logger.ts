// Lichtgewicht structured logger. Console-only voor nu; kan vervangen
// worden door pino/winston als we meer transports nodig hebben.

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  correlation_id?: string;
  user_id?: string;
  route?: string;
  tool?: string;
  [key: string]: unknown;
};

function write(level: LogLevel, message: string, ctx: LogContext = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "verkoopassistent-web",
    message,
    ...ctx,
  });
  // eslint-disable-next-line no-console
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, ctx?: LogContext) => {
    if (process.env.NODE_ENV !== "production") write("debug", msg, ctx);
  },
  info: (msg: string, ctx?: LogContext) => write("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => write("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => write("error", msg, ctx),
  child: (baseCtx: LogContext) => ({
    debug: (msg: string, ctx?: LogContext) =>
      process.env.NODE_ENV !== "production" && write("debug", msg, { ...baseCtx, ...ctx }),
    info: (msg: string, ctx?: LogContext) => write("info", msg, { ...baseCtx, ...ctx }),
    warn: (msg: string, ctx?: LogContext) => write("warn", msg, { ...baseCtx, ...ctx }),
    error: (msg: string, ctx?: LogContext) => write("error", msg, { ...baseCtx, ...ctx }),
  }),
};

export type Logger = typeof logger;
