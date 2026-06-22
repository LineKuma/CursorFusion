const fs = require("fs");
const path = require("path");

const DEFAULT_CONFIG = {
  debug: false,
  outputDir: "./output",
  maxConcurrentTasks: 4,
  timeout: 30000,
  retryCount: 3,
  logLevel: "info",
};

class ConfigManager {
  constructor(configPath) {
    this.configPath = configPath || null;
    this.config = { ...DEFAULT_CONFIG };
    this.loaded = false;
  }

  async load() {
    if (!this.configPath) {
      // 尝试默认路径
      const defaultPaths = [
        path.join(process.cwd(), ".cursorfusionrc.json"),
        path.join(process.cwd(), ".cursorfusionrc.js"),
        path.join(process.cwd(), "cursorfusion.config.json"),
      ];

      for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
          this.configPath = p;
          break;
        }
      }
    }

    if (this.configPath && fs.existsSync(this.configPath)) {
      const raw = fs.readFileSync(this.configPath, "utf-8");
      const ext = path.extname(this.configPath);

      if (ext === ".json") {
        try {
          const userConfig = JSON.parse(raw);
          this.config = this._merge(DEFAULT_CONFIG, userConfig);
        } catch (e) {
          throw new Error(`Invalid JSON in ${this.configPath}: ${e.message}`);
        }
      } else if (ext === ".js") {
        // 简化处理，实际应使用动态 require
        this.config = this._merge(DEFAULT_CONFIG, JSON.parse(raw));
      }
    }

    this.loaded = true;
    return this.config;
  }

  get(key) {
    if (key === undefined) return this.config;
    return this.config[key];
  }

  getAll() {
    return { ...this.config };
  }

  set(key, value) {
    if (typeof key === "object") {
      this.config = { ...this.config, ...key };
    } else {
      this.config[key] = value;
    }
  }

  reset() {
    this.config = { ...DEFAULT_CONFIG };
  }

  _merge(defaults, override) {
    const result = { ...defaults };
    for (const [key, value] of Object.entries(override)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        typeof defaults[key] === "object"
      ) {
        result[key] = this._merge(defaults[key], value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  validate() {
    const errors = [];

    if (
      typeof this.config.maxConcurrentTasks !== "number" ||
      this.config.maxConcurrentTasks < 1
    ) {
      errors.push("maxConcurrentTasks must be a positive number");
    }

    if (typeof this.config.timeout !== "number" || this.config.timeout < 0) {
      errors.push("timeout must be a non-negative number");
    }

    if (
      typeof this.config.retryCount !== "number" ||
      this.config.retryCount < 0
    ) {
      errors.push("retryCount must be a non-negative number");
    }

    const validLevels = ["debug", "info", "warn", "error"];
    if (!validLevels.includes(this.config.logLevel)) {
      errors.push(`logLevel must be one of: ${validLevels.join(", ")}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG };
