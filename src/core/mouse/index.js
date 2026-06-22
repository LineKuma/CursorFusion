/**
 * MouseTracker —— 跨平台鼠标状态追踪器。
 *
 * 自动检测当前平台并选择最优采集方案:
 *   - Linux X11     → xdotool
 *   - Linux Wayland  → ydotool / swaymsg / hyprctl / libinput
 *   - macOS          → CoreGraphics (JXA/osascript)
 *
 * 用法:
 *   const tracker = new MouseTracker();
 *   const event = await tracker.sample();   // 单次采样
 *   const pos    = await tracker.getPosition(); // 仅位置
 *   const state  = await tracker.getState();    // 仅状态
 *
 *   // 持续追踪
 *   const stop = tracker.track(100, (event) => {
 *     console.log(event.position.x, event.position.y);
 *   });
 *   stop(); // 停止
 */
const { X11Platform } = require("./platforms/x11");
const { WaylandPlatform } = require("./platforms/wayland");
const { MacOSPlatform } = require("./platforms/macos");
const { BasePlatform } = require("./platforms/base");
const { CURSOR_TYPES } = require("./types");

class MouseTracker {
  constructor(options = {}) {
    this._platformName = options.platform || null;
    this._platform = null;
    this._initialized = false;
    this._tracking = null;
  }

  // ------------------------------------------------------------------
  // 平台检测与初始化
  // ------------------------------------------------------------------

  /**
   * 自动检测平台并初始化采集器。
   * 可传入 config 强制指定平台: { platform: 'x11' | 'wayland' | 'macos' }
   */
  init() {
    if (this._initialized) return this;

    const platformMap = {
      x11: X11Platform,
      wayland: WaylandPlatform,
      macos: MacOSPlatform,
    };

    // 如果指定了平台名，直接使用
    if (this._platformName && platformMap[this._platformName]) {
      this._platform = new platformMap[this._platformName]();
    } else {
      // 自动检测
      const candidates = [X11Platform, WaylandPlatform, MacOSPlatform];
      for (const Candidate of candidates) {
        if (Candidate.isAvailable()) {
          this._platform = new Candidate();
          break;
        }
      }
    }

    if (!this._platform) {
      this._platform = new BasePlatform();
    }

    this._initialized = true;
    return this;
  }

  /** 当前平台名称 */
  get platformName() {
    this._ensureInit();
    return this._platform.name;
  }

  /** 可用性检查 */
  static isAvailable() {
    return (
      X11Platform.isAvailable() ||
      WaylandPlatform.isAvailable() ||
      MacOSPlatform.isAvailable()
    );
  }

  // ------------------------------------------------------------------
  // 采样方法
  // ------------------------------------------------------------------

  /** 获取屏幕尺寸 */
  getScreenSize() {
    this._ensureInit();
    return this._platform.getScreenSize();
  }

  /** 获取鼠标位置 */
  async getPosition() {
    this._ensureInit();
    return this._platform.getPosition();
  }

  /** 获取鼠标状态 */
  async getState() {
    this._ensureInit();
    return this._platform.getState();
  }

  /** 一次完整采样（位置 + 状态） */
  async sample() {
    this._ensureInit();
    return this._platform.sample();
  }

  // ------------------------------------------------------------------
  // 持续追踪
  // ------------------------------------------------------------------

  /**
   * 按固定间隔持续追踪鼠标。
   * @param {number}   intervalMs  采样间隔（毫秒），默认 100
   * @param {Function} callback    每次采样的回调 (event) => void
   * @returns {Function} stop() 停止追踪
   */
  track(intervalMs, callback) {
    this._ensureInit();
    const interval = intervalMs || 100;
    let stopped = false;

    const loop = async () => {
      try {
        const event = await this._platform.sample();
        callback(event);
      } catch (err) {
        callback(null, err);
      }
      if (!stopped) {
        this._tracking = setTimeout(loop, interval);
      }
    };

    loop();

    return () => {
      stopped = true;
      if (this._tracking) {
        clearTimeout(this._tracking);
        this._tracking = null;
      }
    };
  }

  // ------------------------------------------------------------------
  // 内部
  // ------------------------------------------------------------------

  _ensureInit() {
    if (!this._initialized) {
      this.init();
    }
  }
}

module.exports = { MouseTracker, CURSOR_TYPES };
