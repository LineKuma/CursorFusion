/**
 * BridgeClient — JSON-RPC 2.0 客户端
 * 通过子进程 stdin/stdout 与 C# 核心通信
 */

const { spawn } = require('child_process');
const path = require('path');

class BridgeClient {
  constructor() {
    this.process = null;
    this.requestId = 0;
    this.pending = new Map();
    this.buffer = '';
    this.platform = 'unknown';
    this.intervalId = null;
  }

  /**
   * 启动 C# 核心进程
   */
  async start() {
    const projectDir = path.resolve(__dirname, '../core/cs/CursorFusion.Core');

    return new Promise((resolve, reject) => {
      this.process = spawn('dotnet', ['run', '--project', projectDir], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, DOTNET_ENVIRONMENT: 'Production' },
      });

      this.process.stdout.on('data', (data) => {
        this.handleResponse(data.toString());
      });

      this.process.stderr.on('data', (data) => {
        console.error('[Bridge] Core stderr:', data.toString().trim());
      });

      this.process.on('error', (err) => {
        console.error('[Bridge] Failed to start core process:', err.message);
        reject(err);
      });

      this.process.on('close', (code) => {
        console.log(`[Bridge] Core process exited with code ${code}`);
        this.process = null;
      });

      // 等待核心就绪后发送握手
      setTimeout(async () => {
        try {
          const result = await this.sendRequest('core.platform');
          this.platform = result.platform || 'unknown';
          resolve(this.platform);
        } catch (e) {
          // 如果核心未就绪，使用 unknown 平台
          this.platform = 'unknown';
          resolve('unknown');
        }
      }, 500);
    });
  }

  /**
   * 发送 JSON-RPC 请求
   * @param {string} method - RPC 方法名
   * @param {object} [params] - 参数
   * @returns {Promise<any>}
   */
  sendRequest(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }) + '\n';

      this.pending.set(id, { resolve, reject });

      if (this.process && this.process.stdin.writable) {
        this.process.stdin.write(request);
      } else {
        this.pending.delete(id);
        reject(new Error('Core process not running'));
      }
    });
  }

  /**
   * 处理来自 C# 核心的响应
   */
  handleResponse(data) {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const response = JSON.parse(line);
        const pending = this.pending.get(response.id);

        if (pending) {
          this.pending.delete(response.id);

          if (response.error) {
            pending.reject(new Error(response.error.message));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  /**
   * 获取平台名称
   */
  getPlatformName() {
    return this.platform;
  }

  /**
   * 开始鼠标追踪
   * @param {number} interval - 采样间隔 (ms)
   * @param {function} callback - 回调函数 (event) => void
   * @returns {function} stop - 停止追踪的函数
   */
  startTracking(interval, callback) {
    let running = true;

    const tick = async () => {
      if (!running) return;

      try {
        const event = await this.sendRequest('mouse.sample');
        callback(event);
      } catch (err) {
        console.error('[Bridge] Tracking error:', err.message);
      }

      if (running) {
        this.intervalId = setTimeout(tick, interval);
      }
    };

    // 立即开始第一次采样
    tick();

    // 返回停止函数
    return () => {
      running = false;
      if (this.intervalId) {
        clearTimeout(this.intervalId);
        this.intervalId = null;
      }
    };
  }

  /**
   * 停止核心进程
   */
  async stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }

    if (this.process) {
      this.process.stdin.end();
      this.process.kill('SIGTERM');

      // 等待最多 3 秒后强制终止
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process) this.process.kill('SIGKILL');
          resolve();
        }, 3000);

        this.process.on('close', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }
}

module.exports = BridgeClient;