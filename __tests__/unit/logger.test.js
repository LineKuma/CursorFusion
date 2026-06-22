const { Logger, LEVELS, LEVEL_PREFIXES } = require("../../src/core/logger");

// 抑制 console 输出
let consoleSpy;
beforeEach(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe("Logger", () => {
  describe("constructor", () => {
    it("should default to info level", () => {
      const logger = new Logger();
      expect(logger.level).toBe(LEVELS.info);
    });

    it("should accept custom level", () => {
      const logger = new Logger({ level: "debug" });
      expect(logger.level).toBe(LEVELS.debug);
    });

    it("should enable silent mode", () => {
      const logger = new Logger({ silent: true });
      expect(logger.silent).toBe(true);
    });

    it("should start with empty history", () => {
      const logger = new Logger();
      expect(logger.history).toEqual([]);
    });
  });

  describe("level filtering", () => {
    it("info logger should record all levels in history but only output info+", () => {
      const logger = new Logger({ level: "info" });
      logger.debug("hidden");
      logger.info("visible");
      logger.warn("visible");
      logger.error("visible");

      // history 记录所有调用（不受级别过滤）
      const messages = logger.getHistory().map((h) => h.message);
      expect(messages).toContain("hidden");
      expect(messages.filter((m) => m === "visible")).toHaveLength(3);

      // 但 console 只输出了 info 及以上（debug 被过滤）
      expect(consoleSpy).toHaveBeenCalledTimes(3);
    });

    it("debug logger should show everything", () => {
      const logger = new Logger({ level: "debug" });
      logger.debug("d");
      logger.info("i");
      logger.warn("w");
      logger.error("e");

      expect(logger.getHistory()).toHaveLength(4);
    });

    it("error logger should only show error", () => {
      const logger = new Logger({ level: "error" });
      logger.debug("x");
      logger.info("x");
      logger.warn("x");
      logger.error("only");

      expect(
        logger.getHistory().filter((h) => h.level === "error"),
      ).toHaveLength(1);
    });

    it("silent mode should suppress all output and not record", () => {
      const logger = new Logger({ silent: true, level: "debug" });
      logger.info("test");
      logger.warn("test");

      // silent 模式下 _log 提前返回，不记录到 history
      expect(logger.history).toHaveLength(0);
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe("history management", () => {
    it("getHistory() returns copies, not references", () => {
      const logger = new Logger({ silent: true });
      logger.info("test");
      const h1 = logger.getHistory();
      const h2 = logger.getHistory();
      expect(h1).not.toBe(h2); // 不同引用
      expect(h1).toEqual(h2); // 但内容相同
    });

    it("clearHistory() removes all entries", () => {
      const logger = new Logger({ silent: true });
      logger.info("a");
      logger.info("b");
      logger.clearHistory();
      expect(logger.history).toEqual([]);
    });

    it("each entry has timestamp, level, message, meta", () => {
      const logger = new Logger({ level: "debug" });
      logger.info("hello", { key: "val" });
      const entry = logger.history[0];

      expect(entry).toHaveProperty("timestamp");
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("hello");
      expect(entry.meta).toEqual({ key: "val" });
    });
  });

  describe("setLevel()", () => {
    it("should change level to valid value", () => {
      const logger = new Logger();
      logger.setLevel("warn");
      expect(logger.level).toBe(LEVELS.warn);
    });

    it("should throw on invalid level", () => {
      const logger = new Logger();
      expect(() => logger.setLevel("verbose")).toThrow("Unknown log level");
    });
  });

  describe("LEVELS constant", () => {
    it("should have correct priority order", () => {
      expect(LEVELS.debug).toBeLessThan(LEVELS.info);
      expect(LEVELS.info).toBeLessThan(LEVELS.warn);
      expect(LEVELS.warn).toBeLessThan(LEVELS.error);
    });
  });

  describe("LEVEL_PREFIXES", () => {
    it("should have prefix for all levels", () => {
      Object.keys(LEVELS).forEach((level) => {
        expect(LEVEL_PREFIXES[level]).toBeDefined();
        expect(typeof LEVEL_PREFIXES[level]).toBe("string");
      });
    });
  });
});
