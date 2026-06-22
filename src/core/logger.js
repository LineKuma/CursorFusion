const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_PREFIXES = {
  debug: "[DEBUG]",
  info: "[INFO]",
  warn: "[WARN]",
  error: "[ERROR]",
};

class Logger {
  constructor(options = {}) {
    this.level = LEVELS[options.level] ?? LEVELS.info;
    this.silent = !!options.silent;
    this.history = [];
  }

  _log(level, message, meta = {}) {
    if (this.silent) return;

    const entry = {
      level,
      message,
      meta,
      timestamp: new Date().toISOString(),
    };

    this.history.push(entry);

    if (LEVELS[level] >= this.level) {
      const prefix = LEVEL_PREFIXES[level];
      const output = `${entry.timestamp} ${prefix} ${message}`;
      if (meta && Object.keys(meta).length > 0) {
        console.log(output, meta);
      } else {
        console.log(output);
      }
    }
  }

  debug(message, meta) {
    this._log("debug", message, meta);
  }
  info(message, meta) {
    this._log("info", message, meta);
  }
  warn(message, meta) {
    this._log("warn", message, meta);
  }
  error(message, meta) {
    this._log("error", message, meta);
  }

  getHistory() {
    return [...this.history];
  }

  clearHistory() {
    this.history = [];
  }

  setLevel(level) {
    if (level in LEVELS) {
      this.level = LEVELS[level];
    } else {
      throw new Error(
        `Unknown log level: ${level}. Valid levels: ${Object.keys(LEVELS).join(", ")}`,
      );
    }
  }
}

module.exports = { Logger, LEVELS, LEVEL_PREFIXES };
