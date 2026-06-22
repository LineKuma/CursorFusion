/**
 * Bridge — CursorFusion C# 核心 ↔ JS UI 桥接层
 * 
 * 该模块作为 Vue UI 与 C# 核心之间的桥梁，
 * 通过 JSON-RPC 2.0 over stdin/stdout 进行通信。
 * 
 * 用法:
 *   const bridge = require('./bridge');
 *   const platform = bridge.getPlatformName();
 *   const stop = bridge.startTracking(100, (event) => { ... });
 */

const BridgeClient = require('./BridgeClient');

let client = null;

/**
 * 初始化桥接（惰性加载）
 */
async function getClient() {
  if (!client) {
    client = new BridgeClient();
    try {
      await client.start();
    } catch (err) {
      console.warn('[Bridge] Failed to start core, using fallback:', err.message);
    }
  }
  return client;
}

/**
 * 获取当前平台名称
 * @returns {string}
 */
function getPlatformName() {
  return client ? client.getPlatformName() : 'unknown';
}

/**
 * 开始鼠标追踪
 * @param {number} interval - 采样间隔 (ms)
 * @param {function} callback - 回调函数 (event) => void
 * @returns {function} stop - 停止追踪的函数
 */
function startTracking(interval, callback) {
  return getClient().then((c) => c.startTracking(interval, callback));
}

module.exports = {
  getPlatformName,
  startTracking,
};