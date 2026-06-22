/**
 * macOS 平台鼠标追踪 —— 通过 CoreGraphics + osascript 实现。
 *
 * 方案:
 *   1. 鼠标位置:  osascript 调用 CoreGraphics (无需额外依赖)
 *   2. 按键状态:  osascript 调用 CGEventSourceButtonState
 *   3. 屏幕尺寸:  system_profiler 或 osascript
 *   4. 光标类型:  NSCursor (有限支持，macOS 安全模型限制)
 *
 * 无外部依赖 —— 全部使用 macOS 内置工具。
 */
const { BasePlatform } = require("./base");
const { createMouseEvent, CURSOR_TYPES } = require("../types");

class MacOSPlatform extends BasePlatform {
  get name() {
    return "macos";
  }

  static isAvailable() {
    return process.platform === "darwin";
  }

  // ------------------------------------------------------------------
  // 屏幕尺寸
  // ------------------------------------------------------------------
  getScreenSize() {
    if (this._screenW && this._screenH) {
      return { width: this._screenW, height: this._screenH };
    }

    const script = `
      tell application "Finder"
        set b to bounds of window of desktop
        return (item 3 of b) & "x" & (item 4 of b)
      end tell
    `;
    const out = this._tryExec(`osascript -e '${script}' 2>/dev/null`);
    if (out) {
      const match = out.match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        this._screenW = parseInt(match[1], 10);
        this._screenH = parseInt(match[2], 10);
      }
    }

    // 回退: system_profiler
    if (!this._screenW) {
      const sp = this._tryExec(
        "system_profiler SPDisplaysDataType 2>/dev/null | grep Resolution",
      );
      if (sp) {
        const match = sp.match(/(\d+)\s*x\s*(\d+)/);
        if (match) {
          this._screenW = parseInt(match[1], 10);
          this._screenH = parseInt(match[2], 10);
        }
      }
    }

    return { width: this._screenW, height: this._screenH };
  }

  // ------------------------------------------------------------------
  // 鼠标位置 —— 通过 JXA (JavaScript for Automation) 获取
  // ------------------------------------------------------------------
  async getPosition() {
    const { width, height } = this.getScreenSize();

    // 使用 osascript 内嵌 JavaScript (JXA) 调用 CoreGraphics
    const script = `
      ObjC.import('CoreGraphics');
      var pos = $.CGEventGetLocation($.CGEventCreate($()));
      pos.x + ',' + pos.y
    `;
    const jxa = `osascript -l JavaScript -e '${script}' 2>/dev/null`;

    const out = this._tryExec(jxa);
    let x = 0;
    let y = 0;

    if (out) {
      const parts = out.split(",");
      x = parseInt(parts[0], 10) || 0;
      y = parseInt(parts[1], 10) || 0;
    }

    // 回退: osascript 传统方式
    if (x === 0 && y === 0) {
      const fallback = this._tryExec(
        `osascript -e 'tell application "System Events" to get the position of the mouse' 2>/dev/null`,
      );
      if (fallback) {
        const match = fallback.match(/(\d+)\s*,\s*(\d+)/);
        if (match) {
          x = parseInt(match[1], 10);
          y = parseInt(match[2], 10);
        }
      }
    }

    return createMouseEvent(
      x,
      y,
      [],
      CURSOR_TYPES.DEFAULT,
      this.name,
      width,
      height,
    );
  }

  // ------------------------------------------------------------------
  // 鼠标状态（按键 + 光标类型）
  // ------------------------------------------------------------------
  async getState() {
    const buttons = this._getButtonStates();
    const cursorType = this._detectCursorType();

    return createMouseEvent(
      0,
      0,
      buttons,
      cursorType,
      this.name,
      this._screenW,
      this._screenH,
    );
  }

  // ------------------------------------------------------------------
  // 内部方法
  // ------------------------------------------------------------------

  /** 通过 JXA 获取按键状态 */
  _getButtonStates() {
    const buttons = [];

    // JXA 调用 CoreGraphics CGEventSourceButtonState
    const script = `
      ObjC.import('CoreGraphics');
      var src = $.CGEventSourceCreate($.kCGEventSourceStateCombinedSessionState);
      var left = $.CGEventSourceButtonState($.kCGEventSourceStateCombinedSessionState, $.kCGMouseButtonLeft);
      var right = $.CGEventSourceButtonState($.kCGEventSourceStateCombinedSessionState, $.kCGMouseButtonRight);
      var center = $.CGEventSourceButtonState($.kCGEventSourceStateCombinedSessionState, $.kCGMouseButtonCenter);
      'LEFT:' + left + '|RIGHT:' + right + '|CENTER:' + center
    `;
    const out = this._tryExec(
      `osascript -l JavaScript -e '${script}' 2>/dev/null`,
    );

    if (out) {
      const leftMatch = out.match(/LEFT:(\d+)/);
      const rightMatch = out.match(/RIGHT:(\d+)/);
      const centerMatch = out.match(/CENTER:(\d+)/);

      if (leftMatch && leftMatch[1] === "1") buttons.push([0, true]);
      if (rightMatch && rightMatch[1] === "1") buttons.push([2, true]);
      if (centerMatch && centerMatch[1] === "1") buttons.push([1, true]);
    }

    return buttons;
  }

  /** 检测光标类型 */
  _detectCursorType() {
    // macOS 安全模型限制，无法直接获取全局光标类型
    // 通过当前活跃应用类型推断

    const frontApp = this._tryExec(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null`,
    );

    if (!frontApp) return CURSOR_TYPES.DEFAULT;

    const app = frontApp.toLowerCase().trim();

    const textApps = [
      "terminal",
      "iterm",
      "code",
      "sublime",
      "textedit",
      "vim",
      "neovim",
      "xcode",
      "notes",
      "bear",
      "obsidian",
      "notion",
    ];
    const browserApps = ["safari", "chrome", "firefox", "edge", "brave", "arc"];

    if (textApps.some((a) => app.includes(a))) {
      return CURSOR_TYPES.TEXT;
    }
    if (browserApps.some((a) => app.includes(a))) {
      // 浏览器中光标通常为 pointer 或 default
      return CURSOR_TYPES.POINTER;
    }

    return CURSOR_TYPES.DEFAULT;
  }
}

module.exports = { MacOSPlatform };
