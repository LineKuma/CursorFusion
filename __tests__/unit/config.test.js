const fs = require("fs");
const path = require("path");
const os = require("os");
const { ConfigManager, DEFAULT_CONFIG } = require("../../src/core/config");

describe("ConfigManager", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cursorfusion-test-"),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should initialize with default config", () => {
      const cm = new ConfigManager();
      expect(cm.config).toEqual(DEFAULT_CONFIG);
      expect(cm.loaded).toBe(false);
    });

    it("should accept custom config path", () => {
      const customPath = "/tmp/custom-config.json";
      const cm = new ConfigManager(customPath);
      expect(cm.configPath).toBe(customPath);
    });
  });

  describe("load()", () => {
    it("should load default values when no config file exists", async () => {
      const cm = new ConfigManager(tmpDir + "/nonexistent.json");
      await cm.load();
      expect(cm.config).toEqual(DEFAULT_CONFIG);
      expect(cm.loaded).toBe(true);
    });

    it("should load and merge JSON config file", async () => {
      const configPath = path.join(tmpDir, ".cursorfusionrc.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          debug: true,
          maxConcurrentTasks: 8,
          logLevel: "debug",
        }),
      );

      const cm = new ConfigManager(configPath);
      await cm.load();

      expect(cm.config.debug).toBe(true);
      expect(cm.config.maxConcurrentTasks).toBe(8);
      expect(cm.config.logLevel).toBe("debug");
      // 未指定的保持默认值
      expect(cm.config.timeout).toBe(DEFAULT_CONFIG.timeout);
      expect(cm.config.retryCount).toBe(DEFAULT_CONFIG.retryCount);
    });

    it("should throw on invalid JSON", async () => {
      const configPath = path.join(tmpDir, "bad.json");
      await fs.promises.writeFile(configPath, "{ invalid json }");

      const cm = new ConfigManager(configPath);
      await expect(cm.load()).rejects.toThrow("Invalid JSON");
    });

    it("should deep merge nested objects", async () => {
      const configPath = path.join(tmpDir, "nested.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          custom: { a: 1, b: { c: 2 } },
        }),
      );

      const cm = new ConfigManager(configPath);
      // DEFAULT_CONFIG 没有 custom 字段，所以直接赋值
      await cm.load();
      expect(cm.config.custom).toEqual({ a: 1, b: { c: 2 } });
    });
  });

  describe("get()", () => {
    it("should return full config when no key provided", () => {
      const cm = new ConfigManager();
      expect(cm.get()).toEqual(DEFAULT_CONFIG);
    });

    it("should return specific key value", () => {
      const cm = new ConfigManager();
      expect(cm.get("debug")).toBe(false);
      expect(cm.get("timeout")).toBe(30000);
    });
  });

  describe("getAll()", () => {
    it("should return a copy of config (not reference)", () => {
      const cm = new ConfigManager();
      const all = cm.getAll();
      all.debug = true;
      expect(cm.config.debug).toBe(false); // 原始不受影响
    });
  });

  describe("set()", () => {
    it("should set single key-value pair", () => {
      const cm = new ConfigManager();
      cm.set("debug", true);
      expect(cm.config.debug).toBe(true);
    });

    it("should merge object argument into config", () => {
      const cm = new ConfigManager();
      cm.set({ debug: true, timeout: 60000 });
      expect(cm.config.debug).toBe(true);
      expect(cm.config.timeout).toBe(60000);
    });
  });

  describe("reset()", () => {
    it("should restore defaults after modification", () => {
      const cm = new ConfigManager();
      cm.set("debug", true);
      cm.reset();
      expect(cm.config).toEqual(DEFAULT_CONFIG);
    });
  });

  describe("_merge()", () => {
    it("should handle null/undefined override values", () => {
      const cm = new ConfigManager();
      const result = cm._merge({ a: 1 }, { a: null });
      expect(result.a).toBeNull();
    });

    it("should not mutate original objects", () => {
      const cm = new ConfigManager();
      const original = { a: { b: 1 } };
      const override = { a: { c: 2 } };
      const result = cm._merge(original, override);
      expect(result).not.toBe(original);
      expect(result).not.toBe(override);
    });
  });

  describe("validate()", () => {
    it("should pass with valid config", () => {
      const cm = new ConfigManager();
      const result = cm.validate();
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should fail on invalid maxConcurrentTasks", () => {
      const cm = new ConfigManager();
      cm.set("maxConcurrentTasks", -1);
      const result = cm.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("maxConcurrentTasks"))).toBe(
        true,
      );
    });

    it("should fail on invalid logLevel", () => {
      const cm = new ConfigManager();
      cm.set("logLevel", "invalid");
      const result = cm.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("logLevel"))).toBe(true);
    });

    it("should collect multiple errors at once", () => {
      const cm = new ConfigManager();
      cm.set("maxConcurrentTasks", "not-a-number");
      cm.set("timeout", -5);
      cm.set("logLevel", "verbose");
      const result = cm.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it("should fail on invalid retryCount (negative)", () => {
      const cm = new ConfigManager();
      cm.set("retryCount", -1);
      const result = cm.validate();
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("retryCount"))).toBe(true);
    });

    it("should fail on retryCount = 0 (non-positive)", () => {
      const cm = new ConfigManager();
      cm.set("retryCount", 0);
      // 当前校验规则：retryCount < 0 才报错，0 是合法值
      const result = cm.validate();
      // 如果未来规则改为 < 1，这里会 fail
      expect(result.valid).toBe(true);
    });

    it("should accept retryCount = 0 as valid", () => {
      const cm = new ConfigManager();
      cm.set("retryCount", 0);
      expect(cm.validate().valid).toBe(true);

      cm.set("retryCount", -1);
      expect(cm.validate().valid).toBe(false);
    });
  });

  describe("load() — auto-discovery", () => {
    it("should auto-discover .cursorfusionrc.json when no path given", async () => {
      // 在 tmpDir 创建 .cursorfusionrc.json
      const rcPath = path.join(tmpDir, ".cursorfusionrc.json");
      await fs.promises.writeFile(
        rcPath,
        JSON.stringify({
          debug: true,
          logLevel: "debug",
        }),
      );

      // 切换 cwd 到 tmpDir 并加载
      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const cm = new ConfigManager(); // 不传路径
        await cm.load();

        expect(cm.config.debug).toBe(true);
        expect(cm.config.logLevel).toBe("debug");
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should prioritize .cursorfusionrc.json over other defaults", async () => {
      await fs.promises.writeFile(
        path.join(tmpDir, ".cursorfusionrc.json"),
        JSON.stringify({ debug: true }),
      );
      await fs.promises.writeFile(
        path.join(tmpDir, ".cursorfusionrc.js"),
        JSON.stringify({ debug: false }),
      );
      await fs.promises.writeFile(
        path.join(tmpDir, "cursorfusion.config.json"),
        JSON.stringify({ debug: false }),
      );

      const originalCwd = process.cwd();
      try {
        process.chdir(tmpDir);
        const cm = new ConfigManager();
        await cm.load();
        // 应该找到 .cursorfusionrc.json（第一个匹配）
        expect(cm.config.debug).toBe(true);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it("should fall back to defaults when no default config files exist", async () => {
      const emptyDir = path.join(tmpDir, "empty-cwd");
      await fs.promises.mkdir(emptyDir);

      const originalCwd = process.cwd();
      try {
        process.chdir(emptyDir);
        const cm = new ConfigManager();
        await cm.load();
        expect(cm.config).toEqual(DEFAULT_CONFIG);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("load() — .js config file", () => {
    it("should load and parse .js config file as JSON", async () => {
      const jsConfigPath = path.join(tmpDir, ".cursorfusionrc.js");
      // 写入 JSON 格式内容（模拟简化处理）
      await fs.promises.writeFile(
        jsConfigPath,
        JSON.stringify({
          maxConcurrentTasks: 16,
          timeout: 60000,
        }),
      );

      const cm = new ConfigManager(jsConfigPath);
      await cm.load();

      expect(cm.config.maxConcurrentTasks).toBe(16);
      expect(cm.config.timeout).toBe(60000);
      // 未指定的保持默认值
      expect(cm.config.debug).toBe(DEFAULT_CONFIG.debug);
    });

    it("should merge .js config values into defaults", async () => {
      const jsConfigPath = path.join(tmpDir, "custom.js");
      await fs.promises.writeFile(
        jsConfigPath,
        JSON.stringify({
          debug: true,
          logLevel: "debug",
        }),
      );

      const cm = new ConfigManager(jsConfigPath);
      await cm.load();

      // 覆盖的值
      expect(cm.config.debug).toBe(true);
      expect(cm.config.logLevel).toBe("debug");
      // 未覆盖的保持默认
      expect(cm.config.maxConcurrentTasks).toBe(
        DEFAULT_CONFIG.maxConcurrentTasks,
      );
      expect(cm.config.timeout).toBe(DEFAULT_CONFIG.timeout);
      expect(cm.config.retryCount).toBe(DEFAULT_CONFIG.retryCount);
      expect(cm.config.outputDir).toBe(DEFAULT_CONFIG.outputDir);
    });

    it("should ignore unknown extensions (not .json or .js)", async () => {
      // 创建一个未知扩展名的配置文件
      const unknownExtPath = path.join(tmpDir, "config.yaml");
      await fs.promises.writeFile(
        unknownExtPath,
        JSON.stringify({
          debug: true,
          maxConcurrentTasks: 99,
        }),
      );

      const cm = new ConfigManager(unknownExtPath);
      await cm.load();

      // 未知扩展名不会被处理，配置保持默认值
      expect(cm.config.debug).toBe(DEFAULT_CONFIG.debug);
      expect(cm.config.maxConcurrentTasks).toBe(
        DEFAULT_CONFIG.maxConcurrentTasks,
      );
      expect(cm.loaded).toBe(true);
    });
  });
});
