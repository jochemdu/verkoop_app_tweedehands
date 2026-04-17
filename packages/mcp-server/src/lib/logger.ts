// Structured logger voor MCP server — stuurt naar stderr zodat Claude Desktop
// het in de MCP log-stream kan opnemen (stdout is gereserveerd voor JSON-RPC).

type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = {
  correlation_id?: string;
  tool?: string;
  duration_ms?: number;
  [key: string]: unknown;
};

function write(level: LogLevel, message: string, ctx: LogContext = {}) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "verkoopassistent-mcp",
    message,
    ...ctx,
  });
  // All output → stderr (stdout = MCP JSON-RPC only).
  process.stderr.write(line + "\n");
}

export const logger = {
  info: (msg: string, ctx?: LogContext) => write("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => write("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => write("error", msg, ctx),
};

export function traceTool<TArgs, TResult>(
  name: string,
  handler: (args: TArgs) => Promise<TResult>,
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs) => {
    const correlation_id = crypto.randomUUID();
    const started = Date.now();
    logger.info(`tool.call`, { tool: name, correlation_id });
    try {
      const result = await handler(args);
      logger.info(`tool.done`, {
        tool: name,
        correlation_id,
        duration_ms: Date.now() - started,
      });
      return result;
    } catch (err) {
      logger.error(`tool.error`, {
        tool: name,
        correlation_id,
        duration_ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  };
}
