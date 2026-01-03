export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug: (message: string, fields?: Record<string, unknown>) => void;
  info: (message: string, fields?: Record<string, unknown>) => void;
  warn: (message: string, fields?: Record<string, unknown>) => void;
  error: (message: string, fields?: Record<string, unknown>) => void;
};

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack
    };
  }
  return { message: String(err) };
}

function toLogObject(params: {
  level: LogLevel;
  component: string;
  message: string;
  fields?: Record<string, unknown>;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level: params.level,
    component: params.component,
    message: params.message
  };

  const fields = params.fields ?? {};
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Error) base[key] = serializeError(value);
    else if (value !== undefined) base[key] = value;
  }

  return base;
}

/**
 * CloudWatch Logs で追いやすい JSON 1行ログを出すための logger を作ります。
 */
export function createLogger(component: string): Logger {
  const write = (level: LogLevel, message: string, fields?: Record<string, unknown>) => {
    // 1行JSONに揃える（CloudWatch上でフィルタしやすくする）
    const obj = toLogObject({ level, component, message, fields });
    process.stdout.write(JSON.stringify(obj) + "\n");
  };

  return {
    debug: (message, fields) => write("debug", message, fields),
    info: (message, fields) => write("info", message, fields),
    warn: (message, fields) => write("warn", message, fields),
    error: (message, fields) => write("error", message, fields)
  };
}

