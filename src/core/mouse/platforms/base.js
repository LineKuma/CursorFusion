/**
 * 平台探测实现基类 —— 不直接使用，由各平台子类继承。
 */
const { execSync } = require("child_process");
const { createMouseEvent } = require("../types");

class BasePlatform {
  constructor() {
    this._screenW = null;
    this._screenH = null;
  }

  /** 平台名称（子类覆盖） */
  get name() {
    return "unknown";
  }

  /** 是否可用（子类覆盖） */
  static isAvailable() {
    return false;
  }

  /**
   * 执行命令并返回 stdout 字符串。失败时抛出。
   */
  _exec(cmd, timeout = 3000) {
    return execSync(cmd, {
      timeout,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }

  /**
   * 尝试执行命令，失败返回 null。
   */
  _tryExec(cmd, timeout = 2000) {
    try {
      return this._exec(cmd, timeout);
    } catch {
      return null;
    }
  }

  /**
   * 获取屏幕尺寸 { width, height }。
   * 子类应覆盖以实现平台特定逻辑。
   */
  getScreenSize() {
    return { width: this._screenW, height: this._screenH };
  }

  /**
   * 获取鼠标位置 —— 子类必须实现。
   * @returns {Promise<MouseEvent>}
   */
  async getPosition() {
    throw new Error("getPosition() not implemented");
  }

  /**
   * 获取鼠标状态（按键 + 光标类型） —— 子类必须实现。
   * @returns {Promise<MouseEvent>}
   */
  async getState() {
    throw new Error("getState() not implemented");
  }

  /**
   * 一次采样：位置 + 状态。
   * @returns {Promise<MouseEvent>}
   */
  async sample() {
    const [posEvent, stateEvent] = await Promise.all([
      this.getPosition(),
      this.getState(),
    ]);

    const pos = posEvent.position;
    const state = stateEvent.state;

    return createMouseEvent(
      pos.x,
      pos.y,
      state.buttons.map((b) => [b.button, b.pressed]),
      state.cursorType,
      this.name,
      pos.screenWidth,
      pos.screenHeight,
    );
  }
}

module.exports = { BasePlatform };
