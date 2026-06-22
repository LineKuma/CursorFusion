/**
 * Deno Runtime Bridge — 与 C# 核心通过 JSON-RPC 通信
 * 
 * 通信协议: JSON-RPC 2.0 over stdin/stdout
 * 请求格式: { jsonrpc: "2.0", id: number, method: string, params: object }
 * 响应格式: { jsonrpc: "2.0", id: number, result: object } | { jsonrpc: "2.0", id: number, error: { code: number, message: string } }
 */

import type { MousePosition, MouseState, MouseEvent } from './types.ts';

/** JSON-RPC 请求 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 成功响应 */
interface JsonRpcSuccess {
  jsonrpc: '2.0';
  id: number;
  result: unknown;
}

/** JSON-RPC 错误响应 */
interface JsonRpcError {
  jsonrpc: '2.0';
  id: number;
  error: {
    code: number;
    message: string;
  };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcError;

/** 核心运行时客户端 */
export class CoreRuntime {
  private requestId = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = '';

  /**
   * 发送 JSON-RPC 请求到 C# 核心
   */
  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });

      const json = JSON.stringify(request) + '\n';
      Deno.stdout.writeSync(this.encoder.encode(json));
    });
  }

  /**
   * 处理来自 C# 核心的响应（由 mod.ts 调用）
   */
  handleResponse(data: string): void {
    this.buffer += data;

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response: JsonRpcResponse = JSON.parse(line);

        if ('error' in response) {
          const pending = this.pending.get(response.id);
          if (pending) {
            this.pending.delete(response.id);
            pending.reject(new Error(response.error.message));
          }
        } else {
          const pending = this.pending.get(response.id);
          if (pending) {
            this.pending.delete(response.id);
            pending.resolve(response.result);
          }
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  /** 获取鼠标位置 */
  async getMousePosition(): Promise<MousePosition> {
    return this.sendRequest('mouse.getPosition') as Promise<MousePosition>;
  }

  /** 获取鼠标状态 */
  async getMouseState(): Promise<MouseState> {
    return this.sendRequest('mouse.getState') as Promise<MouseState>;
  }

  /** 采样鼠标事件 */
  async sampleMouse(): Promise<MouseEvent> {
    return this.sendRequest('mouse.sample') as Promise<MouseEvent>;
  }

  /** 读取配置 */
  async getConfig<T>(key: string, defaultValue?: T): Promise<T> {
    const result = await this.sendRequest('config.get', { key, defaultValue });
    return result as T;
  }

  /** 写入配置 */
  async setConfig(key: string, value: unknown): Promise<void> {
    await this.sendRequest('config.set', { key, value });
  }

  /** 扩展存储 — 读取 */
  async storageGet<T>(extensionId: string, key: string): Promise<T | null> {
    return this.sendRequest('storage.get', { extensionId, key }) as Promise<T | null>;
  }

  /** 扩展存储 — 写入 */
  async storageSet(extensionId: string, key: string, value: unknown): Promise<void> {
    await this.sendRequest('storage.set', { extensionId, key, value });
  }

  /** 扩展存储 — 删除 */
  async storageDelete(extensionId: string, key: string): Promise<void> {
    await this.sendRequest('storage.delete', { extensionId, key });
  }
}