/**
 * CursorFusion Deno Extension API Types
 * 定义扩展与核心系统之间的类型接口
 */

/** 鼠标位置 */
export interface MousePosition {
  x: number;
  y: number;
  screenWidth?: number;
  screenHeight?: number;
}

/** 鼠标按键状态 */
export interface MouseButtonState {
  button: number;
  pressed: boolean;
  name: string;
}

/** 鼠标状态 */
export interface MouseState {
  buttons: MouseButtonState[];
  cursorType: string;
  isAnyButtonDown: boolean;
}

/** 鼠标事件 */
export interface MouseEvent {
  timestamp: number;
  position: MousePosition;
  state: MouseState;
  platform: string;
}

/** 扩展上下文 — 提供给每个扩展的 API */
export interface ExtensionContext {
  /** 扩展 ID */
  id: string;
  /** 扩展名称 */
  name: string;
  /** 日志输出 */
  log: (level: LogLevel, message: string, ...args: unknown[]) => void;
  /** 获取当前鼠标位置 */
  getMousePosition: () => Promise<MousePosition>;
  /** 获取当前鼠标状态 */
  getMouseState: () => Promise<MouseState>;
  /** 采样鼠标事件 */
  sampleMouse: () => Promise<MouseEvent>;
  /** 读取配置 */
  getConfig: <T = unknown>(key: string, defaultValue?: T) => Promise<T>;
  /** 写入配置 */
  setConfig: (key: string, value: unknown) => Promise<void>;
  /** 存储扩展私有数据 */
  storage: ExtensionStorage;
}

/** 扩展存储接口 */
export interface ExtensionStorage {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
}

/** 日志级别 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** 扩展定义 — 每个扩展必须导出此接口 */
export interface Extension {
  /** 扩展 ID（必须唯一） */
  id: string;
  /** 扩展名称 */
  name: string;
  /** 扩展版本 */
  version: string;
  /** 扩展描述 */
  description?: string;
  /** 激活时调用 */
  activate: (ctx: ExtensionContext) => Promise<void> | void;
  /** 停用时调用 */
  deactivate?: (ctx: ExtensionContext) => Promise<void> | void;
}

/** 扩展清单（从 extension.json 读取） */
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  main: string;
  permissions?: DenoPermission[];
}

/** 扩展运行时权限 */
export type DenoPermission =
  | 'read'
  | 'write'
  | 'run'
  | 'net'
  | 'env'
  | 'ffi';