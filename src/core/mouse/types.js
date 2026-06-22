/**
 * 鼠标相关的类型定义 —— 跨平台统一接口。
 *
 * MousePosition   : 指针坐标
 * MouseButtonState: 按键状态
 * MouseState      : 指针状态聚合（光标类型 + 按键）
 * MouseEvent      : 一次完整采样（位置 + 状态 + 元数据）
 */

// ---------------------------------------------------------------------------
// 光标类型枚举
// ---------------------------------------------------------------------------
const CURSOR_TYPES = Object.freeze({
  DEFAULT: "default",
  POINTER: "pointer",
  TEXT: "text",
  CROSSHAIR: "crosshair",
  MOVE: "move",
  RESIZE_N: "resize-n",
  RESIZE_S: "resize-s",
  RESIZE_E: "resize-e",
  RESIZE_W: "resize-w",
  RESIZE_NE: "resize-ne",
  RESIZE_NW: "resize-nw",
  RESIZE_SE: "resize-se",
  RESIZE_SW: "resize-sw",
  ROW_RESIZE: "row-resize",
  COL_RESIZE: "col-resize",
  NOT_ALLOWED: "not-allowed",
  GRAB: "grab",
  GRABBING: "grabbing",
  WAIT: "wait",
  PROGRESS: "progress",
  HELP: "help",
  ZOOM_IN: "zoom-in",
  ZOOM_OUT: "zoom-out",
  NONE: "none",
  UNKNOWN: "unknown",
});

// ---------------------------------------------------------------------------
// 鼠标按钮
// ---------------------------------------------------------------------------
const BUTTON_NAMES = Object.freeze({
  0: "left",
  1: "middle",
  2: "right",
  3: "back",
  4: "forward",
});

// ---------------------------------------------------------------------------
// MousePosition —— 指针坐标
// ---------------------------------------------------------------------------
class MousePosition {
  /**
   * @param {number} x  屏幕横坐标 (px)
   * @param {number} y  屏幕纵坐标 (px)
   * @param {number} [screenWidth]  主显示器宽度
   * @param {number} [screenHeight] 主显示器高度
   */
  constructor(x, y, screenWidth, screenHeight) {
    this.x = x;
    this.y = y;
    this.screenWidth = screenWidth || null;
    this.screenHeight = screenHeight || null;
  }

  /** 相对横坐标 (0-1)，需屏幕尺寸已知 */
  get relativeX() {
    if (this.screenWidth == null) return null;
    return this.x / this.screenWidth;
  }

  /** 相对纵坐标 (0-1) */
  get relativeY() {
    if (this.screenHeight == null) return null;
    return this.y / this.screenHeight;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      screenWidth: this.screenWidth,
      screenHeight: this.screenHeight,
      relativeX: this.relativeX,
      relativeY: this.relativeY,
    };
  }
}

// ---------------------------------------------------------------------------
// MouseButtonState —— 按键状态
// ---------------------------------------------------------------------------
class MouseButtonState {
  /**
   * @param {number}  button 按钮编号 (0=左, 1=中, 2=右, 3=后, 4=前)
   * @param {boolean} pressed 是否按下
   */
  constructor(button, pressed) {
    this.button = button;
    this.name = BUTTON_NAMES[button] || `button-${button}`;
    this.pressed = pressed;
  }

  toJSON() {
    return {
      button: this.button,
      name: this.name,
      pressed: this.pressed,
    };
  }
}

// ---------------------------------------------------------------------------
// MouseState —— 指针状态（光标类型 + 按键）
// ---------------------------------------------------------------------------
class MouseState {
  /**
   * @param {string}             cursorType  光标类型 (CURSOR_TYPES)
   * @param {MouseButtonState[]} buttons     当前按下的按键列表
   */
  constructor(cursorType, buttons) {
    this.cursorType = cursorType || CURSOR_TYPES.UNKNOWN;
    this.buttons = buttons || [];
  }

  /** 当前是否有按键按下 */
  get isAnyButtonDown() {
    return this.buttons.some((b) => b.pressed);
  }

  /** 左键是否按下 */
  get isLeftDown() {
    return this.buttons.some((b) => b.button === 0 && b.pressed);
  }

  /** 右键是否按下 */
  get isRightDown() {
    return this.buttons.some((b) => b.button === 2 && b.pressed);
  }

  /** 中键是否按下 */
  get isMiddleDown() {
    return this.buttons.some((b) => b.button === 1 && b.pressed);
  }

  /** 获取指定编号的按键状态 */
  getButton(button) {
    return this.buttons.find((b) => b.button === button) || null;
  }

  toJSON() {
    return {
      cursorType: this.cursorType,
      buttons: this.buttons.map((b) => b.toJSON()),
      isAnyButtonDown: this.isAnyButtonDown,
      isLeftDown: this.isLeftDown,
      isRightDown: this.isRightDown,
      isMiddleDown: this.isMiddleDown,
    };
  }
}

// ---------------------------------------------------------------------------
// MouseEvent —— 一次完整采样
// ---------------------------------------------------------------------------
class MouseEvent {
  /**
   * @param {MousePosition} position
   * @param {MouseState}    state
   * @param {string}        platform  来源平台 (x11 / wayland / macos / unknown)
   */
  constructor(position, state, platform) {
    this.position = position;
    this.state = state;
    this.platform = platform || "unknown";
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      position: this.position.toJSON(),
      state: this.state.toJSON(),
      platform: this.platform,
      timestamp: this.timestamp,
    };
  }
}

// ---------------------------------------------------------------------------
// 工厂方法
// ---------------------------------------------------------------------------
function createMouseEvent(
  x,
  y,
  buttons,
  cursorType,
  platform,
  screenW,
  screenH,
) {
  const pos = new MousePosition(x, y, screenW, screenH);
  const btnStates = (buttons || []).map(
    ([btn, pressed]) => new MouseButtonState(btn, pressed),
  );
  const state = new MouseState(cursorType, btnStates);
  return new MouseEvent(pos, state, platform);
}

module.exports = {
  CURSOR_TYPES,
  BUTTON_NAMES,
  MousePosition,
  MouseButtonState,
  MouseState,
  MouseEvent,
  createMouseEvent,
};
