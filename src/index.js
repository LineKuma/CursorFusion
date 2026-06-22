/**
 * CursorFusion - A modern development tool.
 * Main entry point.
 */

const { ConfigManager } = require('./core/config');
const { Logger } = require('./core/logger');
const { VersionInfo } = require('./core/version');
const { FileUtils } = require('./core/file-utils');

class CursorFusion {
  constructor(options = {}) {
    this.config = new ConfigManager(options.configPath);
    this.logger = new Logger({ level: options.logLevel || 'info', silent: options.silent });
    this.version = new VersionInfo();
    this.fileUtils = new FileUtils();
  }

  async init() {
    this.logger.info('CursorFusion initializing...');
    await this.config.load();
    this.logger.info(`CursorFusion v${this.version.toString()} initialized`);
    return this;
  }

  getVersion() {
    return this.version.toString();
  }

  getConfig() {
    return this.config.getAll();
  }
}

module.exports = { CursorFusion };
