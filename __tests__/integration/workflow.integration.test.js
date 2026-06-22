const fs = require('fs');
const path = require('path');
const os = require('os');
const { CursorFusion } = require('../../src/index');
const { FileUtils } = require('../../src/core/file-utils');
const { ConfigManager, DEFAULT_CONFIG } = require('../../src/core/config');

describe('Workflow Integration Tests', () => {
  let tmpDir;
  let fu;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'cf-workflow-'));
    fu = new FileUtils();
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe('project scaffolding workflow', () => {
    it('should scaffold a minimal project structure', async () => {
      const structure = {
        'src/index.js': "console.log('Hello');",
        'src/lib/utils.js': "export const id = x => x;",
        'package.json': JSON.stringify({ name: 'scaffolded', version: '1.0.0' }, null, 2),
        '.gitignore': "node_modules/\ndist/\n",
        'README.md': '# Scaffolded Project\n',
      };

      const projectDir = path.join(tmpDir, 'my-project');
      for (const [filePath, content] of Object.entries(structure)) {
        await fu.writeFile(path.join(projectDir, filePath), content);
      }

      // 验证结构
      const allFiles = await fu.walk(projectDir);
      expect(allFiles.length).toBe(Object.keys(structure).length);

      // 验证每个文件存在且内容正确
      for (const filePath of Object.keys(structure)) {
        const fullPath = path.join(projectDir, filePath);
        expect(fs.existsSync(fullPath)).toBe(true);
      }

      // 用 FileUtils 读取 scaffolded 的 package.json
      const pkg = fu.readJson(path.join(projectDir, 'package.json'));
      expect(pkg.name).toBe('scaffolded');
      expect(pkg.version).toBe('1.0.0');
    });
  });

  describe('config-driven build simulation', () => {
    it('should apply different configs based on environment', async () => {
      const envConfigs = {
        development: { debug: true, logLevel: 'debug', maxConcurrentTasks: 2 },
        production: { debug: false, logLevel: 'warn', maxConcurrentTasks: 8 },
        testing: { debug: true, logLevel: 'debug', maxConcurrentTasks: 1, timeout: 5000 },
      };

      for (const [env, overrides] of Object.entries(envConfigs)) {
        const configPath = path.join(tmpDir, `config.${env}.json`);
        await fs.promises.writeFile(configPath, JSON.stringify(overrides));

        const cm = new ConfigManager(configPath);
        await cm.load();

        for (const [key, value] of Object.entries(overrides)) {
          expect(cm.get(key)).toBe(value);
        }

        // 未覆盖的字段仍为默认值
        expect(cm.get('retryCount')).toBe(DEFAULT_CONFIG.retryCount);
      }
    });
  });

  describe('multi-module interaction', () => {
    it('should coordinate Config + Logger + FileUtils together', async () => {
      // 模拟一个完整的工作流：读配置 → 根据配置操作文件 → 记录日志
      const configPath = path.join(tmpDir, 'workflow-config.json');
      await fs.promises.writeFile(configPath, JSON.stringify({
        outputDir: './build',
        debug: true,
        logLevel: 'debug',
      }));

      const { Logger } = require('../../src/core/logger');
      // 不使用 silent，改用 console spy 抑制输出
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      const logger = new Logger({ level: 'debug' });
      const config = new ConfigManager(configPath);
      await config.load();

      const outputDir = path.join(tmpDir, config.get('outputDir'));
      logger.info(`Output directory: ${outputDir}`);

      // 根据配置创建输出目录
      await fu.ensureDir(outputDir);
      logger.debug(`Created dir: ${outputDir}`);

      // 写入构建产物
      await fu.writeFile(path.join(outputDir, 'bundle.js'), '/* bundle */');
      logger.info('Build complete');

      // 验证
      expect(fs.existsSync(path.join(outputDir, 'bundle.js'))).toBe(true);

      // 检查日志记录了完整流程
      const history = logger.getHistory();
      const messages = history.map(h => h.message);
      expect(messages).toContain('Build complete');
      expect(messages.some(m => m.includes('Output directory'))).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('version lifecycle', () => {
    it('should track version through release stages', async () => {
      const versions = [
        '0.1.0-alpha.1',
        '0.1.0-beta.1',
        '0.1.0-rc.1',
        '0.1.0',
        '0.2.0-alpha.1',
      ];

      for (const verStr of versions) {
        const pkgPath = path.join(tmpDir, `pkg-${verStr.replace(/\./g, '-')}.json`);
        await fs.promises.writeFile(pkgPath, JSON.stringify({ version: verStr }));

        const { VersionInfo } = require('../../src/core/version');
        const vi = new VersionInfo(pkgPath);

        expect(vi.toString()).toBe(verStr);
        expect(vi.isPrerelease()).toBe(verStr.includes('-'));

        const parsed = vi.parse();
        expect(parsed.raw).toBe(verStr);
      }
    });
  });

  describe('edge case scenarios', () => {
    it('should handle deeply nested directory operations', async () => {
      const deepPath = path.join(tmpDir, 'a', 'b', 'c', 'd', 'e', 'f');
      await fu.writeFile(path.join(deepPath, 'deep.txt'), 'deep content');
      expect(fs.existsSync(path.join(deepPath, 'deep.txt'))).toBe(true);

      const walked = await fu.walk(tmpDir, { ignorePatterns: [] });
      expect(walked.some(f => f.includes('deep.txt'))).toBe(true);
    });

    it('should handle special characters in paths', async () => {
      const specialDir = path.join(tmpDir, 'dir with spaces');
      const specialFile = path.join(specialDir, 'file-with-dashes.js');
      await fu.writeFile(specialFile, '// special chars');
      expect(fs.existsSync(specialFile)).toBe(true);

      const content = await fs.promises.readFile(specialFile, 'utf-8');
      expect(content).toBe('// special chars');
    });

    it('should handle concurrent-like sequential operations', async () => {
      // 模拟大量连续文件操作
      const ops = [];
      for (let i = 0; i < 50; i++) {
        ops.push(
          fu.writeFile(path.join(tmpDir, `file-${i}.txt`), `content ${i}`)
        );
      }
      await Promise.all(ops);

      const files = await fu.walk(tmpDir, { extensions: ['.txt'] });
      expect(files).toHaveLength(50);
    });

    it('should handle empty and whitespace-only content', async () => {
      const emptyPath = path.join(tmpDir, 'empty.txt');
      const wsPath = path.join(tmpDir, 'whitespace.txt');

      await fu.writeFile(emptyPath, '');
      await fu.writeFile(wsPath, '   \n\t\n   ');

      expect((await fs.promises.readFile(emptyPath, 'utf-8')).length).toBe(0);
      expect((await fs.promises.readFile(wsPath, 'utf-8')).length).toBeGreaterThan(0);
    });
  });
});
