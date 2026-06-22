/**
 * CursorFusion 端到端测试
 * 模拟真实用户场景，覆盖完整工作流。
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { CursorFusion } = require("../../src/index");
const { ConfigManager, DEFAULT_CONFIG } = require("../../src/core/config");
const { Logger } = require("../../src/core/logger");
const { VersionInfo } = require("../../src/core/version");
const { FileUtils } = require("../../src/core/file-utils");

// ============================================================
// 辅助函数
// ============================================================
function spawnCLI(args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [path.join(__dirname, "../../bin/cursorfusion.js"), ...args],
      { ...options, stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ code, stdout, stderr }));
    proc.on("error", reject);
  });
}

// ============================================================
// 测试套件
// ============================================================
describe("CursorFusion E2E", () => {
  let tmpDir;
  let consoleSpy;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cf-e2e-"));
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(async () => {
    consoleSpy.mockRestore();
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  // ============================================================
  // 1. CLI 启动与生命周期
  // ============================================================
  describe("CLI 启动与生命周期", () => {
    it("应该通过 CLI 成功启动并输出版本信息", async () => {
      const { code, stdout } = await spawnCLI([], { cwd: tmpDir });
      expect(code).toBe(0);
      expect(stdout).toMatch(/CursorFusion/);
      expect(stdout).toMatch(/0\.\d+\.\d+/);
    });

    it("应该通过 JS API 成功初始化并返回自身", async () => {
      const cf = new CursorFusion({ silent: true });
      const instance = await cf.init();
      expect(instance).toBe(cf);
      expect(instance instanceof CursorFusion).toBe(true);
    });

    it("应该支持链式初始化后立即获取版本和配置", async () => {
      const cf = await new CursorFusion({ silent: true }).init();
      expect(cf.getVersion()).toBeTruthy();
      expect(cf.getConfig()).toBeDefined();
      expect(cf.getConfig().debug).toBe(false);
    });

    it("应该在非静默模式下输出日志到 console", async () => {
      const spy = jest.spyOn(console, "log");
      const cf = new CursorFusion({ silent: false, logLevel: "info" });
      await cf.init();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });

    it("应该在静默模式下不输出到 console", async () => {
      const spy = jest.spyOn(console, "log");
      const cf = new CursorFusion({ silent: true, logLevel: "debug" });
      await cf.init();
      const called = spy.mock.calls.some((c) =>
        String(c[0]).includes("initializing"),
      );
      expect(called).toBe(false);
      spy.mockRestore();
    });
  });

  // ============================================================
  // 2. 完整项目初始化 → 构建 → 验证流程
  // ============================================================
  describe("完整项目初始化 → 构建 → 验证", () => {
    it("应该走通 创建项目 → 写配置 → 构建 → 验证产物 的完整流程", async () => {
      const cf = await new CursorFusion({ silent: true }).init();
      const fu = cf.fileUtils;

      // 阶段 1: 创建项目结构
      const projectDir = path.join(tmpDir, "my-app");
      const structure = {
        "src/index.js": "// main entry",
        "src/lib/utils.js": "function sum(a,b){return a+b}",
        "src/lib/logger.js": "// logger module",
        "src/config/app.json": '{"port": 3000}',
        "package.json": JSON.stringify(
          { name: "my-app", version: "1.0.0" },
          null,
          2,
        ),
        ".env": "NODE_ENV=development",
        "README.md": "# My App",
      };

      for (const [file, content] of Object.entries(structure)) {
        await fu.writeFile(path.join(projectDir, file), content);
      }

      // 阶段 2: 验证文件结构
      const allFiles = await fu.walk(projectDir);
      expect(allFiles.length).toBe(Object.keys(structure).length);

      const jsFiles = await fu.walk(projectDir, { extensions: [".js"] });
      expect(jsFiles).toHaveLength(3);
      expect(jsFiles.every((f) => f.endsWith(".js"))).toBe(true);

      const jsonFiles = await fu.walk(projectDir, { extensions: [".json"] });
      expect(jsonFiles).toHaveLength(2);

      // 阶段 3: 验证 JSON 文件内容
      const pkg = fu.readJson(path.join(projectDir, "package.json"));
      expect(pkg.name).toBe("my-app");
      expect(pkg.version).toBe("1.0.0");

      const appConfig = fu.readJson(
        path.join(projectDir, "src/config/app.json"),
      );
      expect(appConfig.port).toBe(3000);

      // 阶段 4: 模拟构建产物输出
      const buildDir = path.join(projectDir, "dist");
      const buildFiles = {
        "bundle.js": "/* bundled */",
        "bundle.js.map": '{"version":3}',
        "index.html": "<!DOCTYPE html>",
        "assets/style.css": "body{}",
      };
      for (const [file, content] of Object.entries(buildFiles)) {
        await fu.writeFile(path.join(buildDir, file), content);
      }

      // 阶段 5: 验证构建产物
      const buildOutput = await fu.walk(buildDir);
      expect(buildOutput.length).toBe(Object.keys(buildFiles).length);

      // 阶段 6: 清理构建产物
      await fu.cleanDir(buildDir);
      const afterClean = await fu.walk(buildDir);
      expect(afterClean).toHaveLength(0);
    });

    it("应该正确处理软件包版本信息", async () => {
      const vi = new VersionInfo(path.join(tmpDir, "package.json"));
      await fs.promises.writeFile(
        path.join(tmpDir, "package.json"),
        JSON.stringify({ version: "2.3.1-beta.5" }),
      );

      expect(vi.toString()).toBe("2.3.1-beta.5");
      expect(vi.isPrerelease()).toBe(true);
      expect(vi.parse()).toMatchObject({
        major: 2,
        minor: 3,
        patch: 1,
        prerelease: "beta.5",
      });
      expect(vi.compare("2.3.0")).toBe(1);
      expect(vi.compare("2.4.0")).toBe(-1);
      expect(vi.compare("2.3.1")).toBe(-1); // 预发布低于正式版
      expect(vi.satisfies("^2.0.0")).toBe(true);
      expect(vi.satisfies("^3.0.0")).toBe(false);
    });
  });

  // ============================================================
  // 3. 多环境配置编排
  // ============================================================
  describe("多环境配置编排", () => {
    it("应该支持 dev → staging → prod 三套环境配置切换", async () => {
      const envs = {
        development: {
          debug: true,
          logLevel: "debug",
          maxConcurrentTasks: 2,
          timeout: 60000,
          retryCount: 1,
          outputDir: "./dev-dist",
        },
        staging: {
          debug: true,
          logLevel: "info",
          maxConcurrentTasks: 4,
          timeout: 30000,
          retryCount: 2,
          outputDir: "./staging-dist",
        },
        production: {
          debug: false,
          logLevel: "warn",
          maxConcurrentTasks: 8,
          timeout: 15000,
          retryCount: 3,
          outputDir: "./dist",
        },
      };

      for (const [env, cfg] of Object.entries(envs)) {
        const configPath = path.join(tmpDir, `cursorfusion.${env}.config.json`);
        await fs.promises.writeFile(configPath, JSON.stringify(cfg));

        const cm = new ConfigManager(configPath);
        await cm.load();

        // 验证所有覆盖值
        for (const key of Object.keys(cfg)) {
          expect(cm.get(key)).toBe(cfg[key]);
        }

        // 所有环境配置必须通过验证
        const result = cm.validate();
        expect(result.valid).toBe(true);
      }
    });

    it("应该通过配置驱动日志行为", async () => {
      const configPath = path.join(tmpDir, "config.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({ logLevel: "error" }),
      );

      const cm = new ConfigManager(configPath);
      await cm.load();

      const logger = new Logger({ level: cm.get("logLevel") });

      logger.debug("should not appear");
      logger.info("should not appear");
      logger.warn("should not appear"); // level error means only error goes through
      logger.error("THIS IS AN ERROR");

      const history = logger.getHistory();

      // debug/info/warn 不应出现在 history 中（silent=false 时仍记录 history）
      // 由于 silent=false，history 会记录所有，但控制台只输出 error 级别
      expect(history.length).toBe(4);
      // 控制台只应输出 error
      const consoleCalls = consoleSpy.mock.calls.filter(
        (c) => c[0] && c[0].includes("[ERROR]"),
      );
      expect(consoleCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ============================================================
  // 4. 跨模块协同工作流
  // ============================================================
  describe("跨模块协同工作流", () => {
    it("应该完成 Config → Logger → FileUtils → Version 全链路协同", async () => {
      // 模拟真实场景：用户配置项目 → 初始化日志 → 操作文件 → 检查版本
      const configPath = path.join(tmpDir, "project.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          debug: true,
          logLevel: "debug",
          outputDir: "./build",
          maxConcurrentTasks: 4,
        }),
      );

      const config = new ConfigManager(configPath);
      await config.load();

      const logger = new Logger({ level: config.get("logLevel") });
      const fu = new FileUtils();
      const vi = new VersionInfo();

      logger.info("Phase 1: Configuration loaded");
      expect(config.validate().valid).toBe(true);

      logger.debug("Phase 2: Building output directory");
      const outputDir = path.join(tmpDir, config.get("outputDir"));
      await fu.ensureDir(outputDir);

      logger.info("Phase 3: Writing build artifacts");
      const artifacts = ["bundle.js", "vendor.js", "app.css", "index.html"];
      for (const name of artifacts) {
        await fu.writeFile(path.join(outputDir, name), `/* ${name} content */`);
      }

      logger.info("Phase 4: Validating output");
      const built = await fu.walk(outputDir);
      expect(built).toHaveLength(artifacts.length);

      // 版本检查
      logger.info(`Phase 5: Version check — ${vi.toString()}`);
      expect(vi.toString()).toBeTruthy();
      expect(vi.compare("0.0.0")).toBeGreaterThanOrEqual(0);

      // 完整日志记录
      const history = logger.getHistory();
      const messages = history.map((h) => h.message);
      expect(messages).toContain("Phase 1: Configuration loaded");
      expect(messages).toContain("Phase 2: Building output directory");
      expect(messages).toContain("Phase 3: Writing build artifacts");
      expect(messages).toContain("Phase 4: Validating output");
      expect(messages.some((m) => m.includes("Phase 5"))).toBe(true);
    });
  });

  // ============================================================
  // 5. 错误恢复与容错
  // ============================================================
  describe("错误恢复与容错", () => {
    it("应该优雅处理不存在的配置路径", async () => {
      const cf = new CursorFusion({
        configPath: "/tmp/nonexistent/config.json",
        silent: true,
      });
      await cf.init();
      expect(cf.getVersion()).toBeTruthy();
      const config = cf.getConfig();
      expect(config).toEqual(DEFAULT_CONFIG);
    });

    it("应该在配置损坏时给出明确错误信息", async () => {
      const configPath = path.join(tmpDir, "broken.json");
      await fs.promises.writeFile(configPath, "this is not json {{");

      const cf = new CursorFusion({ configPath, silent: true });
      await expect(cf.init()).rejects.toThrow();
    });

    it("应该保留配置的回滚机制（set → reset）", async () => {
      const cf = await new CursorFusion({ silent: true }).init();
      const original = cf.getConfig();

      cf.config.set("debug", true);
      cf.config.set("timeout", 999999);
      cf.config.set("logLevel", "error");
      expect(cf.getConfig().debug).toBe(true);
      expect(cf.getConfig().timeout).toBe(999999);

      // 回滚
      cf.config.reset();
      expect(cf.getConfig()).toEqual(original);
      expect(cf.getConfig().debug).toBe(false);
    });

    it("应该在深度嵌套目录中保持文件完整性", async () => {
      const fu = new FileUtils();
      const levels = 10;
      let current = tmpDir;

      for (let i = 0; i < levels; i++) {
        current = path.join(current, `level-${i}`);
        await fu.ensureDir(current);
        await fu.writeFile(
          path.join(current, `file-${i}.txt`),
          `content at level ${i}`,
        );
      }

      const allFiles = await fu.walk(tmpDir, { maxDepth: 20 });
      expect(allFiles.length).toBe(levels);

      // 验证最深层的文件
      const deepest = allFiles.sort(
        (a, b) => b.split(path.sep).length - a.split(path.sep).length,
      )[0];
      expect(fs.existsSync(deepest)).toBe(true);
    });

    it("应该在无效日志级别时抛出错误", async () => {
      const logger = new Logger();
      expect(() => logger.setLevel("nonexistent")).toThrow(/Unknown log level/);
    });
  });

  // ============================================================
  // 6. 大文件量压力测试
  // ============================================================
  describe("大规模操作", () => {
    it("应该正确处理 100 个文件并发写入", async () => {
      const fu = new FileUtils();
      const files = [];

      for (let i = 0; i < 100; i++) {
        files.push(
          fu.writeFile(
            path.join(tmpDir, `thread-${i % 4}`, `file-${i}.js`),
            `// module ${i}`,
          ),
        );
      }
      await Promise.all(files);

      const allFiles = await fu.walk(tmpDir);
      expect(allFiles.length).toBe(100);

      const jsFiles = await fu.walk(tmpDir, { extensions: [".js"] });
      expect(jsFiles).toHaveLength(100);
    });

    it("应该正确处理目录复制（含子目录）", async () => {
      const fu = new FileUtils();
      const srcDir = path.join(tmpDir, "src-lib");

      const structure = {
        "a.js": "// a",
        "b.js": "// b",
        "sub/c.js": "// c",
        "sub/d.js": "// d",
        "sub/deep/e.js": "// e",
        "sub/deep/f.js": "// f",
      };

      for (const [file, content] of Object.entries(structure)) {
        await fu.writeFile(path.join(srcDir, file), content);
      }

      const destDir = path.join(tmpDir, "dest-lib");
      await fu.copyDir(srcDir, destDir);

      const copied = await fu.walk(destDir);
      const original = await fu.walk(srcDir);
      expect(copied.length).toBe(original.length);

      for (const f of copied) {
        const rel = path.relative(destDir, f);
        expect(fs.existsSync(path.join(srcDir, rel))).toBe(true);
      }
    });
  });

  // ============================================================
  // 7. 文件类型检测
  // ============================================================
  describe("文件类型检测", () => {
    it("应该正确识别所有已知文件类型", async () => {
      const fu = new FileUtils();
      const typeMap = [
        ["app.js", "javascript"],
        ["app.ts", "typescript"],
        ["app.jsx", "jsx"],
        ["app.tsx", "tsx"],
        ["config.json", "json"],
        ["readme.md", "markdown"],
        ["deploy.yml", "yaml"],
        ["deploy.yaml", "yaml"],
        ["index.html", "html"],
        ["style.css", "css"],
        ["script.py", "python"],
        ["main.go", "go"],
        ["lib.rs", "rust"],
        ["unknown.xyz", "unknown"],
        ["Makefile", "unknown"],
        ["Dockerfile", "unknown"],
        ["file", "unknown"],
      ];

      for (const [filename, expected] of typeMap) {
        expect(fu.detectType(filename)).toBe(expected);
      }
    });
  });

  // ============================================================
  // 8. 版本比较与兼容性
  // ============================================================
  describe("版本比较与兼容性", () => {
    it("应该正确处理所有 satisfies 运算符", async () => {
      const vi = new VersionInfo(path.join(tmpDir, "version-pkg.json"));
      await fs.promises.writeFile(
        path.join(tmpDir, "version-pkg.json"),
        JSON.stringify({ version: "1.5.3" }),
      );

      // 精确匹配
      expect(vi.satisfies("1.5.3")).toBe(true);
      expect(vi.satisfies("1.5.4")).toBe(false);

      // ^ 语义
      expect(vi.satisfies("^1.0.0")).toBe(true);
      expect(vi.satisfies("^1.5.0")).toBe(true);
      expect(vi.satisfies("^2.0.0")).toBe(false);

      // ~ 语义
      expect(vi.satisfies("~1.5.0")).toBe(true);
      expect(vi.satisfies("~1.6.0")).toBe(false);

      // 比较运算符
      expect(vi.satisfies(">=1.0.0")).toBe(true);
      expect(vi.satisfies(">=2.0.0")).toBe(false);
      expect(vi.satisfies(">1.0.0")).toBe(true);
      expect(vi.satisfies(">1.5.3")).toBe(false);
      expect(vi.satisfies("<=1.5.3")).toBe(true);
      expect(vi.satisfies("<=1.0.0")).toBe(false);
      expect(vi.satisfies("<2.0.0")).toBe(true);
      expect(vi.satisfies("<1.5.3")).toBe(false);
    });

    it("应该正确处理预发布版本链", async () => {
      const prereleaseVersions = [
        "0.1.0-alpha.1",
        "0.1.0-alpha.2",
        "0.1.0-beta.1",
        "0.1.0-rc.1",
        "0.1.0-rc.2",
        "0.1.0",
      ];

      const versions = prereleaseVersions.map((v) => {
        const vi = new VersionInfo(
          path.join(tmpDir, `pkg-${v.replace(/\./g, "-")}.json`),
        );
        fs.writeFileSync(
          path.join(tmpDir, `pkg-${v.replace(/\./g, "-")}.json`),
          JSON.stringify({ version: v }),
        );
        return vi;
      });

      // 所有预发布版本应检测为预发布
      for (let i = 0; i < versions.length - 1; i++) {
        expect(versions[i].isPrerelease()).toBe(true);
      }
      // 最后一个正式版应为非预发布
      expect(versions[versions.length - 1].isPrerelease()).toBe(false);

      // 版本序号递增
      for (let i = 0; i < versions.length - 1; i++) {
        expect(versions[i].compare(versions[i + 1].toString())).toBe(-1);
      }
    });
  });

  // ============================================================
  // 9. 日志系统完整功能
  // ============================================================
  describe("日志系统完整功能", () => {
    it("应该正确过滤各级别日志", async () => {
      const logger = new Logger({ level: "warn" });

      logger.debug("debug msg");
      logger.info("info msg");
      logger.warn("warn msg");
      logger.error("error msg");

      const history = logger.getHistory();
      expect(history).toHaveLength(4);

      // 控制台应只输出 warn 和 error
      const output = consoleSpy.mock.calls.map((c) => c[0]);
      expect(output.some((o) => o && o.includes("[DEBUG]"))).toBe(false);
      expect(output.some((o) => o && o.includes("[INFO]"))).toBe(false);
      expect(output.some((o) => o && o.includes("[WARN]"))).toBe(true);
      expect(output.some((o) => o && o.includes("[ERROR]"))).toBe(true);
    });

    it("应该在 debug 级别输出所有日志", async () => {
      const logger = new Logger({ level: "debug" });

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      const output = consoleSpy.mock.calls.map((c) => c[0]);
      expect(output.some((o) => o && o.includes("[DEBUG]"))).toBe(true);
      expect(output.some((o) => o && o.includes("[INFO]"))).toBe(true);
      expect(output.some((o) => o && o.includes("[WARN]"))).toBe(true);
      expect(output.some((o) => o && o.includes("[ERROR]"))).toBe(true);
    });

    it("应该在 error 级别仅输出 error 日志", async () => {
      const logger = new Logger({ level: "error" });

      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      const output = consoleSpy.mock.calls.map((c) => c[0]);
      expect(output.some((o) => o && o.includes("[DEBUG]"))).toBe(false);
      expect(output.some((o) => o && o.includes("[INFO]"))).toBe(false);
      expect(output.some((o) => o && o.includes("[WARN]"))).toBe(false);
      expect(output.some((o) => o && o.includes("[ERROR]"))).toBe(true);
    });

    it("应该每条日志都有时间戳", async () => {
      const logger = new Logger();
      logger.info("test");
      logger.warn("test2");

      const history = logger.getHistory();
      for (const entry of history) {
        expect(entry.timestamp).toBeTruthy();
        expect(Date.parse(entry.timestamp)).not.toBeNaN();
      }
    });

    it("应该在静默模式下不记录日志", async () => {
      const logger = new Logger({ silent: true });
      logger.info("should not be recorded");
      expect(logger.getHistory()).toHaveLength(0);
    });
  });

  // ============================================================
  // 10. 配置系统完整功能
  // ============================================================
  describe("配置系统完整功能", () => {
    it("应该支持深度合并配置对象", async () => {
      const configPath = path.join(tmpDir, "deep-config.json");
      await fs.promises.writeFile(
        configPath,
        JSON.stringify({
          debug: true,
          custom: { nested: { deep: "value", arr: [1, 2, 3] } },
        }),
      );

      const cm = new ConfigManager(configPath);
      await cm.load();

      expect(cm.get("debug")).toBe(true);
      expect(cm.get("custom")).toEqual({
        nested: { deep: "value", arr: [1, 2, 3] },
      });
      expect(cm.get("retryCount")).toBe(DEFAULT_CONFIG.retryCount);
    });

    it("应该支持对象形式和键值形式的 set", async () => {
      const cm = new ConfigManager();
      await cm.load();

      // 键值形式
      cm.set("debug", true);
      expect(cm.get("debug")).toBe(true);

      // 对象形式
      cm.set({ timeout: 99999, retryCount: 5 });
      expect(cm.get("timeout")).toBe(99999);
      expect(cm.get("retryCount")).toBe(5);
    });

    it("应该验证所有配置约束", async () => {
      const cm = new ConfigManager();
      await cm.load();

      // 默认配置应有效
      expect(cm.validate().valid).toBe(true);

      // 无效 maxConcurrentTasks
      cm.set("maxConcurrentTasks", -1);
      expect(cm.validate().valid).toBe(false);
      expect(cm.validate().errors).toContain(
        "maxConcurrentTasks must be a positive number",
      );

      // 无效 logLevel
      cm.reset();
      cm.set("logLevel", "verbose");
      expect(cm.validate().valid).toBe(false);
      expect(cm.validate().errors.some((e) => e.includes("logLevel"))).toBe(
        true,
      );
    });

    it("应该自动发现默认配置文件", async () => {
      const rcPath = path.join(tmpDir, ".cursorfusionrc.json");
      await fs.promises.writeFile(
        rcPath,
        JSON.stringify({ debug: true, maxConcurrentTasks: 16 }),
      );

      const originalCwd = process.cwd;
      process.cwd = () => tmpDir;

      try {
        const cm = new ConfigManager();
        await cm.load();
        expect(cm.get("debug")).toBe(true);
        expect(cm.get("maxConcurrentTasks")).toBe(16);
      } finally {
        process.cwd = originalCwd;
      }
    });
  });

  // ============================================================
  // 11. FileUtils 完整功能
  // ============================================================
  describe("FileUtils 完整功能", () => {
    it("应该支持文件备份写入", async () => {
      const fu = new FileUtils();
      const filePath = path.join(tmpDir, "data.txt");

      await fu.writeFile(filePath, "version 1");
      await fu.writeFile(filePath, "version 2", { backup: true });

      expect(fs.existsSync(filePath + ".bak")).toBe(true);
      expect(fs.readFileSync(filePath + ".bak", "utf-8")).toBe("version 1");
      expect(fs.readFileSync(filePath, "utf-8")).toBe("version 2");
    });

    it("应该支持 JSON 对象的 writeFile", async () => {
      const fu = new FileUtils();
      const filePath = path.join(tmpDir, "output.json");

      await fu.writeFile(filePath, { name: "test", value: 42 });
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      expect(data.name).toBe("test");
      expect(data.value).toBe(42);
    });

    it("应该在 walk 时正确过滤扩展名", async () => {
      const fu = new FileUtils();
      const files = {
        "a.js": "// js",
        "b.ts": "// ts",
        "c.json": '{"key": "val"}',
        "d.md": "# md",
        "e.js": "// js2",
      };

      for (const [name, content] of Object.entries(files)) {
        await fu.writeFile(path.join(tmpDir, name), content);
      }

      const jsOnly = await fu.walk(tmpDir, { extensions: [".js"] });
      expect(jsOnly).toHaveLength(2);

      const tsOnly = await fu.walk(tmpDir, { extensions: [".ts"] });
      expect(tsOnly).toHaveLength(1);

      const multiExt = await fu.walk(tmpDir, {
        extensions: [".js", ".json"],
      });
      expect(multiExt).toHaveLength(3);
    });

    it("应该在 walk 时正确忽略指定模式", async () => {
      const fu = new FileUtils();
      await fu.ensureDir(path.join(tmpDir, "node_modules", "pkg"));
      await fu.ensureDir(path.join(tmpDir, "src", "lib"));
      await fu.writeFile(
        path.join(tmpDir, "node_modules", "pkg", "index.js"),
        "//",
      );
      await fu.writeFile(
        path.join(tmpDir, "src", "lib", "helper.js"),
        "// helper",
      );
      await fu.writeFile(path.join(tmpDir, "src", "index.js"), "// main");

      const srcOnly = await fu.walk(tmpDir, {
        ignorePatterns: ["node_modules"],
      });
      expect(srcOnly).toHaveLength(2);
      expect(srcOnly.every((f) => !f.includes("node_modules"))).toBe(true);
    });

    it("应该正确处理清理空目录和不存在的目录", async () => {
      const fu = new FileUtils();

      // 清理空目录
      await fu.ensureDir(path.join(tmpDir, "empty-dir"));
      await fu.cleanDir(path.join(tmpDir, "empty-dir"));
      const afterClean = await fu.walk(path.join(tmpDir, "empty-dir"));
      expect(afterClean).toHaveLength(0);

      // 清理不存在的目录不应报错
      await expect(
        fu.cleanDir(path.join(tmpDir, "does-not-exist")),
      ).resolves.toBeUndefined();
    });
  });

  // ============================================================
  // 12. 真实项目构建模拟
  // ============================================================
  describe("真实项目构建模拟", () => {
    it("应该模拟 npm run build 的完整流程", async () => {
      const fu = new FileUtils();

      // 1. 读取 package.json
      const pkgPath = path.join(tmpDir, "package.json");
      await fu.writeFile(pkgPath, {
        name: "build-test",
        version: "1.0.0",
        scripts: {
          build: "echo done",
        },
      });

      // 2. 创建源代码
      const srcDir = path.join(tmpDir, "src");
      const srcFiles = {
        "index.js": "module.exports = {}",
        "core/a.js": "// a",
        "core/b.js": "// b",
        "utils/c.js": "// c",
      };
      for (const [f, content] of Object.entries(srcFiles)) {
        await fu.writeFile(path.join(srcDir, f), content);
      }

      // 3. 模拟构建过程
      const buildDir = path.join(tmpDir, "dist");
      const srcWalked = await fu.walk(srcDir, { extensions: [".js"] });
      expect(srcWalked).toHaveLength(4);

      for (const srcFile of srcWalked) {
        const rel = path.relative(srcDir, srcFile);
        const destFile = path.join(buildDir, rel);
        const content = fs.readFileSync(srcFile, "utf-8");
        await fu.writeFile(destFile, `/* built */\n${content}`);
      }

      // 4. 验证构建产物
      const builtFiles = await fu.walk(buildDir, { extensions: [".js"] });
      expect(builtFiles).toHaveLength(4);
      for (const f of builtFiles) {
        expect(fs.readFileSync(f, "utf-8")).toMatch(/^\/\* built \*\//);
      }
    });

    it("应该正确处理 npm 依赖安装的场景模拟", async () => {
      const fu = new FileUtils();
      const nodeModulesDir = path.join(tmpDir, "node_modules");

      // 模拟多个包安装
      const packages = [
        { name: "lodash", version: "4.17.21" },
        { name: "express", version: "4.18.2" },
        { name: "typescript", version: "5.3.0" },
      ];

      for (const pkg of packages) {
        const pkgDir = path.join(nodeModulesDir, pkg.name);
        await fu.ensureDir(pkgDir);
        await fu.writeFile(path.join(pkgDir, "package.json"), {
          name: pkg.name,
          version: pkg.version,
        });
        await fu.writeFile(
          path.join(pkgDir, "index.js"),
          `module.exports = require('./${pkg.name}')`,
        );
      }

      // 验证所有包已安装
      for (const pkg of packages) {
        expect(
          fs.existsSync(path.join(nodeModulesDir, pkg.name, "package.json")),
        ).toBe(true);
        expect(
          fu.readJson(path.join(nodeModulesDir, pkg.name, "package.json"))
            .version,
        ).toBe(pkg.version);
      }

      const walked = await fu.walk(nodeModulesDir);
      expect(walked.length).toBe(6); // 3 packages × 2 files each
    });
  });
});
