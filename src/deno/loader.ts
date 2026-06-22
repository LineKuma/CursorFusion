/**
 * Extension Loader — 动态加载和管理扩展
 */

import { join, basename, dirname } from 'std/path/mod.ts';
import type { Extension, ExtensionManifest, ExtensionContext, LogLevel } from './types.ts';
import { CoreRuntime } from './runtime.ts';

/** 扩展加载器 */
export class ExtensionLoader {
  private extensions = new Map<string, Extension>();
  private activeExtensions = new Set<string>();
  private runtime: CoreRuntime;
  private extensionsDir: string;

  constructor(runtime: CoreRuntime, extensionsDir: string) {
    this.runtime = runtime;
    this.extensionsDir = extensionsDir;
  }

  /**
   * 扫描并加载所有扩展
   */
  async loadAll(): Promise<void> {
    console.log(`[ExtensionLoader] Scanning extensions in: ${this.extensionsDir}`);

    try {
      const entries = Deno.readDirSync(this.extensionsDir);

      for (const entry of entries) {
        if (!entry.isDirectory) continue;

        const extDir = join(this.extensionsDir, entry.name);
        const manifestPath = join(extDir, 'extension.json');

        try {
          const manifest = await this.loadManifest(manifestPath);
          await this.loadExtension(extDir, manifest);
        } catch (error) {
          console.error(`[ExtensionLoader] Failed to load extension '${entry.name}':`, error);
        }
      }

      console.log(`[ExtensionLoader] Loaded ${this.extensions.size} extension(s)`);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        console.error('[ExtensionLoader] Error scanning extensions:', error);
      }
    }
  }

  /**
   * 加载扩展清单
   */
  private async loadManifest(manifestPath: string): Promise<ExtensionManifest> {
    const content = await Deno.readTextFile(manifestPath);
    const manifest: ExtensionManifest = JSON.parse(content);

    if (!manifest.id || !manifest.name || !manifest.version || !manifest.main) {
      throw new Error(`Invalid manifest: missing required fields (id, name, version, main)`);
    }

    return manifest;
  }

  /**
   * 加载单个扩展
   */
  private async loadExtension(extDir: string, manifest: ExtensionManifest): Promise<void> {
    const mainPath = join(extDir, manifest.main);
    const mainUrl = `file://${mainPath}`;

    console.log(`[ExtensionLoader] Loading extension: ${manifest.id} (${manifest.name})`);

    const mod = await import(mainUrl);
    const extension: Extension = mod.default || mod;

    if (typeof extension.activate !== 'function') {
      throw new Error(`Extension '${manifest.id}' does not export an activate function`);
    }

    this.extensions.set(manifest.id, extension);
  }

  /**
   * 激活指定扩展
   */
  async activate(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension '${extensionId}' not found`);
    }

    if (this.activeExtensions.has(extensionId)) {
      console.warn(`[ExtensionLoader] Extension '${extensionId}' is already active`);
      return;
    }

    const ctx = this.createContext(extension);
    console.log(`[ExtensionLoader] Activating extension: ${extensionId}`);

    await extension.activate(ctx);
    this.activeExtensions.add(extensionId);

    console.log(`[ExtensionLoader] Extension '${extensionId}' activated`);
  }

  /**
   * 停用指定扩展
   */
  async deactivate(extensionId: string): Promise<void> {
    const extension = this.extensions.get(extensionId);
    if (!extension || !this.activeExtensions.has(extensionId)) return;

    const ctx = this.createContext(extension);
    console.log(`[ExtensionLoader] Deactivating extension: ${extensionId}`);

    if (extension.deactivate) {
      await extension.deactivate(ctx);
    }

    this.activeExtensions.delete(extensionId);
    console.log(`[ExtensionLoader] Extension '${extensionId}' deactivated`);
  }

  /**
   * 激活所有扩展
   */
  async activateAll(): Promise<void> {
    for (const id of this.extensions.keys()) {
      await this.activate(id);
    }
  }

  /**
   * 停用所有扩展
   */
  async deactivateAll(): Promise<void> {
    for (const id of this.activeExtensions) {
      await this.deactivate(id);
    }
  }

  /**
   * 获取已加载的扩展列表
   */
  getLoadedExtensions(): string[] {
    return Array.from(this.extensions.keys());
  }

  /**
   * 获取已激活的扩展列表
   */
  getActiveExtensions(): string[] {
    return Array.from(this.activeExtensions);
  }

  /**
   * 为扩展创建上下文
   */
  private createContext(extension: Extension): ExtensionContext {
    const extId = extension.id;

    return {
      id: extId,
      name: extension.name,
      log: (level: LogLevel, message: string, ...args: unknown[]) => {
        const prefix = `[${extId}]`;
        const msg = `${prefix} ${message}`;
        switch (level) {
          case 'debug':
            console.debug(msg, ...args);
            break;
          case 'info':
            console.info(msg, ...args);
            break;
          case 'warn':
            console.warn(msg, ...args);
            break;
          case 'error':
            console.error(msg, ...args);
            break;
        }
      },
      getMousePosition: () => this.runtime.getMousePosition(),
      getMouseState: () => this.runtime.getMouseState(),
      sampleMouse: () => this.runtime.sampleMouse(),
      getConfig: <T>(key: string, defaultValue?: T) =>
        this.runtime.getConfig<T>(key, defaultValue),
      setConfig: (key: string, value: unknown) =>
        this.runtime.setConfig(key, value),
      storage: {
        get: <T>(key: string) => this.runtime.storageGet<T>(extId, key),
        set: (key: string, value: unknown) => this.runtime.storageSet(extId, key, value),
        delete: (key: string) => this.runtime.storageDelete(extId, key),
      },
    };
  }
}