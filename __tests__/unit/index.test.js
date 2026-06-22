const { CursorFusion } = require('../../src/index');

describe('CursorFusion', () => {
  let cf;

  beforeEach(() => {
    cf = new CursorFusion({
      silent: true, // 静默日志避免输出干扰
    });
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(cf.config).toBeDefined();
      expect(cf.logger).toBeDefined();
      expect(cf.version).toBeDefined();
      expect(cf.fileUtils).toBeDefined();
    });

    it('should accept custom options', () => {
      const customCf = new CursorFusion({
        logLevel: 'debug',
        configPath: '/custom/path',
        silent: true,
      });
      expect(customCf.logger.level).toBe(0); // debug = 0
    });
  });

  describe('init()', () => {
    it('should initialize successfully', async () => {
      const result = await cf.init();
      expect(result).toBe(cf); // 返回自身以支持链式调用
    });

    it('should load config during init', async () => {
      await cf.init();
      expect(cf.config.loaded).toBe(true);
    });
  });

  describe('getVersion()', () => {
    it('should return version string', () => {
      const version = cf.getVersion();
      expect(version).toBeTruthy();
      expect(typeof version).toBe('string');
    });
  });

  describe('getConfig()', () => {
    it('should return full config object', async () => {
      await cf.init();
      const config = cf.getConfig();
      expect(config).toHaveProperty('debug');
      expect(config).toHaveProperty('maxConcurrentTasks');
      expect(config).toHaveProperty('timeout');
    });
  });
});
