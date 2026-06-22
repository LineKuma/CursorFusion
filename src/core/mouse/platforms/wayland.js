/**
 * Wayland 平台鼠标追踪。
 *
 * Wayland 安全模型禁止应用直接读取全局鼠标位置，因此需要多级回退策略：
 *
 *   1. ydotool (推荐)  —— 用户态输入工具，模拟 /dev/uinput，需要 root 或 ydotoold 守护进程
 *   2. wlr-randr        —— wlroots 合成器屏幕信息 + swaymsg / hyprctl 获取指针
 *   3. libinput debug-events —— 读取 /dev/input 事件（需要 root）
 *   4. swaymsg / hyprctl —— 合成器特定 IPC（仅 Sway / Hyprland）
 *
 * 安装:
 *   ydotool:  https://github.com/ReimuNotMoe/ydotool (推荐)
 *   wlr-randr: 各发行版包管理器
 *   sway:    sudo apt install sway
 *   hyprctl: Hyprland 自带
 */
const { BasePlatform } = require("./base");
const { createMouseEvent, CURSOR_TYPES } = require("../types");

class WaylandPlatform extends BasePlatform {
  get name() {
    return "wayland";
  }

  static isAvailable() {
    return (
      (process.platform === "linux" || process.platform === "freebsd") &&
      (!!process.env.WAYLAND_DISPLAY ||
        !!process.env.XDG_SESSION_TYPE?.includes("wayland"))
    );
  }

  // ------------------------------------------------------------------
  // 屏幕尺寸
  // ------------------------------------------------------------------
  getScreenSize() {
    if (this._screenW && this._screenH) {
      return { width: this._screenW, height: this._screenH };
    }

    // 策略 1: wlr-randr
    const wlr = this._tryExec("wlr-randr 2>/dev/null");
    if (wlr) {
      const match = wlr.match(/(\d+)x(\d+)\s*px/);
      if (match) {
        this._screenW = parseInt(match[1], 10);
        this._screenH = parseInt(match[2], 10);
      }
    }

    // 策略 2: swaymsg
    if (!this._screenW) {
      const sway = this._tryExec("swaymsg -t get_outputs 2>/dev/null");
      if (sway) {
        try {
          const outputs = JSON.parse(sway);
          for (const out of outputs) {
            if (out.active) {
              const rect = out.rect || out.current_mode;
              this._screenW = rect.width;
              this._screenH = rect.height;
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }
    }

    // 策略 3: hyprctl
    if (!this._screenW) {
      const hypr = this._tryExec("hyprctl monitors -j 2>/dev/null");
      if (hypr) {
        try {
          const monitors = JSON.parse(hypr);
          if (monitors.length > 0) {
            this._screenW = monitors[0].width;
            this._screenH = monitors[0].height;
          }
        } catch {
          /* ignore */
        }
      }
    }

    return { width: this._screenW, height: this._screenH };
  }

  // ------------------------------------------------------------------
  // 鼠标位置
  // ------------------------------------------------------------------
  async getPosition() {
    const { width, height } = this.getScreenSize();
    let x = 0;
    let y = 0;
    let found = false;

    // 策略 1: ydotool (最可靠)
    const ydo = this._tryExec(
      "ydotool mousemove --absolute --get-location 2>/dev/null",
    );
    if (ydo) {
      const match = ydo.match(/(\d+)\s*,\s*(\d+)/);
      if (match) {
        x = parseInt(match[1], 10);
        y = parseInt(match[2], 10);
        found = true;
      }
    }

    // 策略 2: swaymsg
    if (!found) {
      const sway = this._tryExec("swaymsg -t get_tree 2>/dev/null");
      if (sway) {
        try {
          const tree = JSON.parse(sway);
          const seat = this._findSeatRecursive(tree, "pointer");
          if (seat) {
            x = seat.x || 0;
            y = seat.y || 0;
            found = true;
          }
        } catch {
          /* ignore */
        }
      }
    }

    // 策略 3: hyprctl
    if (!found) {
      const hypr = this._tryExec("hyprctl cursorpos 2>/dev/null");
      if (hypr) {
        const match = hypr.match(/(\d+)\s*,\s*(\d+)/);
        if (match) {
          x = parseInt(match[1], 10);
          y = parseInt(match[2], 10);
          found = true;
        }
      }
    }

    // 策略 4: libinput debug-events (需要 root)
    if (!found) {
      const libinput = this._tryExec(
        "timeout 0.2 libinput debug-events --device /dev/input/event* 2>/dev/null | grep -m1 'POINTER_MOTION_ABSOLUTE'",
      );
      if (libinput) {
        const match = libinput.match(/([\d.]+)\/([\d.]+)/);
        if (match && width && height) {
          x = Math.round(parseFloat(match[1]) * width);
          y = Math.round(parseFloat(match[2]) * height);
          found = true;
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
  // 鼠标状态
  // ------------------------------------------------------------------
  async getState() {
    const buttons = [];
    let cursorType = CURSOR_TYPES.DEFAULT;

    // 按键检测：ydotool
    const ydo = this._tryExec(
      "ydotool click --get-state 2>/dev/null || echo ''",
    );
    if (ydo) {
      // ydotool 不直接支持按键状态查询，通过 libinput 回退
    }

    // 按键检测：libinput debug-events
    const libinput = this._tryExec(
      "timeout 0.3 libinput debug-events 2>/dev/null | grep -E 'BTN_LEFT|BTN_RIGHT|BTN_MIDDLE'",
    );
    if (libinput) {
      if (libinput.includes("BTN_LEFT") && libinput.includes("pressed")) {
        buttons.push([0, true]);
      }
      if (libinput.includes("BTN_RIGHT") && libinput.includes("pressed")) {
        buttons.push([2, true]);
      }
      if (libinput.includes("BTN_MIDDLE") && libinput.includes("pressed")) {
        buttons.push([1, true]);
      }
    }

    // 光标类型：Wayland 下无法直接获取，使用推断
    cursorType = this._inferCursorType();

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

  /** 递归查找 seat 中的 pointer 信息 */
  _findSeatRecursive(node, type) {
    if (!node) return null;
    if (node.type === type && node.x !== undefined && node.y !== undefined) {
      return node;
    }
    if (node.focus && Array.isArray(node.focus)) {
      for (const child of node.focus) {
        const found = this._findSeatRecursive(child, type);
        if (found) return found;
      }
    }
    if (node.nodes) {
      for (const child of node.nodes) {
        const found = this._findSeatRecursive(child, type);
        if (found) return found;
      }
    }
    return null;
  }

  /** 推断光标类型 */
  _inferCursorType() {
    // Wayland 下没有通用手段获取光标类型
    // 尝试通过 swaymsg 获取焦点窗口
    const sway = this._tryExec("swaymsg -t get_tree 2>/dev/null");
    if (sway) {
      try {
        const tree = JSON.parse(sway);
        const focused = this._findFocusedNode(tree);
        if (focused) {
          const appId = (focused.app_id || "").toLowerCase();
          const name = (focused.name || "").toLowerCase();
          if (
            appId.includes("terminal") ||
            name.includes("term") ||
            name.includes("editor") ||
            name.includes("code")
          ) {
            return CURSOR_TYPES.TEXT;
          }
          if (appId.includes("browser") || name.includes("browser")) {
            return CURSOR_TYPES.POINTER;
          }
        }
      } catch {
        /* ignore */
      }
    }
    return CURSOR_TYPES.DEFAULT;
  }

  _findFocusedNode(node) {
    if (!node) return null;
    if (node.focused) return node;
    if (node.nodes) {
      for (const child of node.nodes) {
        const found = this._findFocusedNode(child);
        if (found) return found;
      }
    }
    if (node.floating_nodes) {
      for (const child of node.floating_nodes) {
        const found = this._findFocusedNode(child);
        if (found) return found;
      }
    }
    return null;
  }
}

module.exports = { WaylandPlatform };
