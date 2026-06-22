/**
 * X11 平台鼠标追踪 —— 通过 xdotool / xdpyinfo 实现。
 *
 * 依赖:
 *   - xdotool   : 获取鼠标位置、按键状态、光标名称
 *   - xdpyinfo  : 获取屏幕尺寸
 *   - xprop     : 获取光标主题（可选）
 *
 * 安装 (Ubuntu/Debian): sudo apt install xdotool x11-utils
 * 安装 (Fedora):        sudo dnf install xdotool xorg-x11-utils
 * 安装 (Arch):          sudo pacman -S xdotool xorg-xdpyinfo
 */
const { BasePlatform } = require("./base");
const { createMouseEvent, CURSOR_TYPES } = require("../types");

const BUTTON_MAP = { left: 0, middle: 1, right: 2 };

class X11Platform extends BasePlatform {
  get name() {
    return "x11";
  }

  static isAvailable() {
    return (
      (process.platform === "linux" || process.platform === "freebsd") &&
      !!process.env.DISPLAY
    );
  }

  // ------------------------------------------------------------------
  // 屏幕尺寸
  // ------------------------------------------------------------------
  getScreenSize() {
    if (this._screenW && this._screenH) {
      return { width: this._screenW, height: this._screenH };
    }
    const out = this._tryExec("xdpyinfo 2>/dev/null | grep 'dimensions:'");
    if (out) {
      const match = out.match(/(\d+)x(\d+)\s+pixels/);
      if (match) {
        this._screenW = parseInt(match[1], 10);
        this._screenH = parseInt(match[2], 10);
      }
    }
    // 回退：xrandr
    if (!this._screenW) {
      const r = this._tryExec(
        "xrandr --current 2>/dev/null | grep ' connected primary' | grep -oP '\\d+x\\d+'",
      );
      if (r) {
        const [w, h] = r.split("x").map(Number);
        this._screenW = w;
        this._screenH = h;
      }
    }
    return { width: this._screenW, height: this._screenH };
  }

  // ------------------------------------------------------------------
  // 鼠标位置
  // ------------------------------------------------------------------
  async getPosition() {
    const raw = this._exec("xdotool getmouselocation --shell 2>/dev/null");
    const parsed = {};
    for (const line of raw.split("\n")) {
      const eq = line.indexOf("=");
      if (eq > 0) parsed[line.slice(0, eq)] = line.slice(eq + 1);
    }
    const { width, height } = this.getScreenSize();
    return createMouseEvent(
      parseInt(parsed.X || "0", 10),
      parseInt(parsed.Y || "0", 10),
      [],
      CURSOR_TYPES.DEFAULT,
      this.name,
      width,
      height,
    );
  }

  // ------------------------------------------------------------------
  // 鼠标按键
  // ------------------------------------------------------------------
  async getState() {
    // 按键状态：xdotool getmouselocation 只返回位置，不返回按键
    // 需要额外工具：xinput --query-state 或 轮询 /dev/input
    const buttons = [];

    // 方案 A: 使用 xinput query-state 获取主指针状态
    const pointerId = this._findPointerId();
    if (pointerId) {
      const state = this._tryExec(
        `xinput --query-state ${pointerId} 2>/dev/null`,
      );
      if (state) {
        for (const [name, code] of Object.entries(BUTTON_MAP)) {
          const regex = new RegExp(`button\\[${name}\\].*?=.*?down`, "i");
          if (regex.test(state)) {
            buttons.push([code, true]);
          }
        }
      }
    }

    // 方案 B: 回退到 xdotool（只能检测到当前操作的按键，不够准确但永不失败）
    if (buttons.length === 0) {
      // 不添加虚拟按键，因为无法可靠检测
    }

    // 光标类型 —— 通过 X 资源名推断
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

  /** 查找主指针设备 ID */
  _findPointerId() {
    const list = this._tryExec("xinput --list --short 2>/dev/null");
    if (!list) return null;
    for (const line of list.split("\n")) {
      // 匹配 "Virtual core pointer  id=2  [slave  pointer  (2)]"
      const match = line.match(
        /(?:virtual\s+core\s+pointer|master\s+pointer).*?id=(\d+)/i,
      );
      if (match) return match[1];
    }
    return null;
  }

  /** 检测当前光标类型 */
  _detectCursorType() {
    // 通过 xset q 检测光标是否隐藏
    const xset = this._tryExec("xset q 2>/dev/null");
    if (xset && xset.includes("Cursor  off")) {
      return CURSOR_TYPES.NONE;
    }

    // 通过 xdotool 获取当前光标名称（需要 XCursor 主题支持）
    const rootId = this._tryExec(
      "xdotool getactivewindow 2>/dev/null || xdotool getwindowfocus 2>/dev/null",
    );
    if (rootId) {
      const cursorName = this._tryExec(
        `xprop -id ${rootId} -f _NET_WM_ICON_NAME 32u 2>/dev/null`,
      );
      // 大多数情况下无法获取精确光标名，返回 DEFAULT
      if (cursorName) {
        const lower = cursorName.toLowerCase();
        if (lower.includes("text") || lower.includes("ibeam")) {
          return CURSOR_TYPES.TEXT;
        }
        if (lower.includes("wait") || lower.includes("watch")) {
          return CURSOR_TYPES.WAIT;
        }
        if (lower.includes("hand") || lower.includes("pointer")) {
          return CURSOR_TYPES.POINTER;
        }
      }
    }

    return CURSOR_TYPES.DEFAULT;
  }
}

module.exports = { X11Platform };
