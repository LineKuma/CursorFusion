/**
 * CursorFusion Deno Extension Runtime
 * 
 * 用法:
 *   deno run --allow-read --allow-write --allow-run --allow-net mod.ts
 * 
 * 该运行时通过 stdin/stdout 与 C# 核心进行 JSON-RPC 通信，
 * 负责加载、激活和管理用户自定义扩展。
 */

import { join, dirname, fromFileUrl } from 'std/path/mod.ts';
import { CoreRuntime } from './runtime.ts';
import { ExtensionLoader } from './loader.ts';

const __dirname = dirname(fromFileUrl(import.meta.url));
const EXTENSIONS_DIR = join(__dirname, 'extensions');

async function main(): Promise<void> {
  console.log('[CursorFusion Deno] Starting extension runtime...');

  const runtime = new CoreRuntime();
  const loader = new ExtensionLoader(runtime, EXTENSIONS_DIR);

  // 监听 stdin 获取来自 C# 核心的 JSON-RPC 响应
  const decoder = new TextDecoder();
  const buf = new Uint8Array(4096);

  // 加载所有扩展
  await loader.loadAll();

  if (loader.getLoadedExtensions().length === 0) {
    console.log('[CursorFusion Deno] No extensions found. Waiting for commands...');
  } else {
    // 激活所有扩展
    await loader.activateAll();
  }

  // 主循环: 读取 stdin 处理来自 C# 核心的消息
  try {
    while (true) {
      const n = await Deno.stdin.read(buf);
      if (n === null) break;

      const data = decoder.decode(buf.subarray(0, n));
      runtime.handleResponse(data);

      // 将响应写回 stdout
      // JSON-RPC 响应已在 runtime.handleResponse 中处理
    }
  } catch (error) {
    console.error('[CursorFusion Deno] Runtime error:', error);
  } finally {
    // 清理: 停用所有扩展
    await loader.deactivateAll();
    console.log('[CursorFusion Deno] Extension runtime stopped');
  }
}

// 处理退出信号
const shutdown = async () => {
  console.log('\n[CursorFusion Deno] Shutting down...');
  Deno.exit(0);
};

Deno.addSignalListener('SIGTERM', shutdown);
Deno.addSignalListener('SIGINT', shutdown);

main().catch((error) => {
  console.error('[CursorFusion Deno] Fatal error:', error);
  Deno.exit(1);
});