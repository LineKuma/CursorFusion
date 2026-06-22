const fs = require("fs");
const path = require("path");
const os = require("os");
const { CursorFusion } = require("../../src/index");

describe("CursorFusion Integration", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cf-integration-"),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe("full initialization flow", () => {
    it("should complete init → getVersion → getConfig flow", async () => {
      const cf = new CursorFusion({ silent: true });

      // 初始化
      const instance = await cf.init();
      expect(instance).toBe(cf);

      // 获取版本
      const version = cf.getVersion();
      expect(version).toBeTruthy();
      expect(typeof version).toBe("string");

      // 获取配置
      const config = cf.getConfig();
      expect(config).toMatchObject({
        debug: false,
        maxConcurrentTasks: expect.any(Number),
        timeout: expect.any(Number),
        retryCount: expect.any(Number),
        logLevel: expect.any(String),
      });
    });

    it("should work with custom config file", async () => {
      const configPath = path.join(tmpDir, ".cursorfusionrc.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          debug: true,
          maxConcurrentTasks: 16,
          logLevel: "debug",
          customSetting: "works",
        }),
      );

      const cf = new CursorFusion({
        configPath,
        silent: true,
        logLevel: "error",
      });

      await cf.init();
      const config = cf.getConfig();

      expect(config.debug).toBe(true);
      expect(config.maxConcurrentTasks).toBe(16);
      expect(config.customSetting).toBe("works");
    });

    it("should validate config during init", async () => {
      const configPath = path.join(tmpDir, "bad-config.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          maxConcurrentTasks: -5,
          logLevel: "invalid-level",
        }),
      );

      const cf = new CursorFusion({
        configPath,
        silent: true,
      });

      // init 应该成功加载（即使配置无效）
      await cf.init();
      cf.getConfig();

      // 验证应能检测到错误
      const validation = cf.config.validate();
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("logging integration", () => {
    // 抑制 console 输出
    let consoleSpy;
    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    });
    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should collect logs across the full lifecycle", async () => {
      // 不使用 silent，用 consoleSpy 抑制输出，确保 history 正常记录
      const cf = new CursorFusion({
        logLevel: "debug",
      });

      await cf.init();
      cf.getVersion();
      cf.getConfig();

      const history = cf.logger.getHistory();
      expect(history.length).toBeGreaterThan(0);

      // 应该有至少一条 info 级别的日志（来自 init）
      const infoLogs = history.filter((h) => h.level === "info");
      expect(infoLogs.length).toBeGreaterThan(0);
    });

    it("should support changing log level mid-session", async () => {
      const cf = new CursorFusion({
        logLevel: "error",
      });

      await cf.init();
      // 切换到 debug 后，后续日志应被记录
      cf.logger.setLevel("debug");
      cf.logger.debug("now visible");

      const history = cf.logger.getHistory();
      const debugLogs = history.filter((h) => h.level === "debug");
      expect(debugLogs).toContainEqual(
        expect.objectContaining({ message: "now visible" }),
      );
    });
  });

  describe("version integration", () => {
    it("should detect prerelease status consistently", async () => {
      const cf = new CursorFusion({ silent: true });
      await cf.init();

      const isPre = cf.version.isPrerelease();
      const parsed = cf.version.parse();

      // 一致性检查：如果 prerelease 非空，则 isPrerelease 应为 true
      if (parsed.prerelease) {
        expect(isPre).toBe(true);
      } else {
        expect(isPre).toBe(false);
      }
    });

    it("should compare against known versions", async () => {
      const cf = new CursorFusion({ silent: true });
      await cf.init();

      const currentVersion = cf.getVersion();
      // 当前版本应该 >= 0.0.0
      expect(cf.version.compare("0.0.0")).toBeGreaterThanOrEqual(0);
      // 应该满足 ^0.x 或 ^1.x 等
      expect(cf.version.satisfies(`^${currentVersion.split(".")[0]}.0.0`)).toBe(
        true,
      );
    });
  });

  describe("file operations integration", () => {
    it("should walk, write, and read files end-to-end", async () => {
      const cf = new CursorFusion({ silent: true });
      await cf.init();

      // 创建临时工作目录
      const workDir = path.join(tmpDir, "project");
      await cf.fileUtils.ensureDir(workDir);

      // 写入文件
      await cf.fileUtils.writeFile(
        path.join(workDir, "src/main.js"),
        "console.log('hello');",
      );
      await cf.fileUtils.writeFile(
        path.join(workDir, "src/utils/helper.js"),
        "export function helper() {}",
      );
      await cf.fileUtils.writeFile(
        path.join(workDir, "package.json"),
        '{"name": "test"}',
      );

      // 遍历目录
      const jsFiles = await cf.fileUtils.walk(workDir, { extensions: [".js"] });
      expect(jsFiles).toHaveLength(2);

      // 读取 JSON
      const pkg = cf.fileUtils.readJson(path.join(workDir, "package.json"));
      expect(pkg.name).toBe("test");

      // 清理并验证
      await cf.fileUtils.cleanDir(workDir);
      const remaining = await cf.fileUtils.walk(workDir);
      expect(remaining).toHaveLength(0);
    });

    it("should detect file types correctly across project", async () => {
      const cf = new CursorFusion({ silent: true });
      await cf.init();

      const workDir = path.join(tmpDir, "mixed-project");
      await cf.fileUtils.ensureDir(workDir);

      const files = {
        "app.ts": "typescript",
        "index.html": "html",
        "style.css": "css",
        "script.py": "python",
        "main.go": "go",
        "lib.rs": "rust",
        "data.yml": "yaml",
        "readme.md": "markdown",
        "config.json": "json",
      };

      for (const [filename, expectedType] of Object.entries(files)) {
        expect(cf.fileUtils.detectType(filename)).toBe(expectedType);
      }
    });
  });

  describe("error handling integration", () => {
    it("should handle missing config gracefully", async () => {
      const cf = new CursorFusion({
        configPath: "/definitely/not/a/real/path.json",
        silent: true,
      });

      // 即使配置路径不存在也不应崩溃
      await cf.init();
      expect(cf.getVersion()).toBeTruthy();
    });

    it("should handle corrupted config file", async () => {
      const badConfigPath = path.join(tmpDir, "corrupted.json");
      await fs.promises.writeFile(badConfigPath, "{{{not valid json}}}");

      const cf = new CursorFusion({
        configPath: badConfigPath,
        silent: true,
      });

      // init 应该抛出错误或优雅处理
      try {
        await cf.init();
        // 如果没抛错，说明有容错逻辑
      } catch (e) {
        expect(e.message).toContain("Invalid JSON");
      }
    });
  });

  describe("config round-trip", () => {
    it("should survive set → get → reset cycle", async () => {
      const cf = new CursorFusion({ silent: true });
      await cf.init();

      const original = cf.getConfig();

      // 修改
      cf.config.set("debug", true);
      cf.config.set("timeout", 99999);
      expect(cf.getConfig().debug).toBe(true);

      // 重置
      cf.config.reset();
      const restored = cf.getConfig();
      expect(restored).toEqual(original);
    });

    it("should validate before and after modification", async () => {
      const cf = new CursorFusion({ silent: true });
      await cf.init();

      // 初始状态应有效
      expect(cf.config.validate().valid).toBe(true);

      // 注入无效值后应失败
      cf.config.set("maxConcurrentTasks", "oops");
      expect(cf.config.validate().valid).toBe(false);

      // 修复后恢复有效
      cf.config.set("maxConcurrentTasks", 4);
      expect(cf.config.validate().valid).toBe(true);
    });
  });
});
