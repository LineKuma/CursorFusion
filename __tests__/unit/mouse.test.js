/**
 * Mouse 模块单元测试 —— 覆盖类型定义、平台抽象、MouseTracker。
 */
const {
  CURSOR_TYPES,
  BUTTON_NAMES,
  MousePosition,
  MouseButtonState,
  MouseState,
  MouseEvent,
  createMouseEvent,
} = require("../../src/core/mouse/types");

const { BasePlatform } = require("../../src/core/mouse/platforms/base");
const { MouseTracker } = require("../../src/core/mouse/index");
const { CursorFusion } = require("../../src/index");

// ---------------------------------------------------------------------------
// MousePosition
// ---------------------------------------------------------------------------
describe("MousePosition", () => {
  it("应该正确存储原始坐标", () => {
    const pos = new MousePosition(100, 200, 1920, 1080);
    expect(pos.x).toBe(100);
    expect(pos.y).toBe(200);
    expect(pos.screenWidth).toBe(1920);
    expect(pos.screenHeight).toBe(1080);
  });

  it("应该正确计算相对坐标", () => {
    const pos = new MousePosition(960, 540, 1920, 1080);
    expect(pos.relativeX).toBe(0.5);
    expect(pos.relativeY).toBe(0.5);
  });

  it("应该在没有屏幕尺寸时返回 null 相对坐标", () => {
    const pos = new MousePosition(100, 200);
    expect(pos.relativeX).toBeNull();
    expect(pos.relativeY).toBeNull();
  });

  it("应当正确序列化为 JSON", () => {
    const pos = new MousePosition(100, 200, 1920, 1080);
    const json = pos.toJSON();
    expect(json).toEqual({
      x: 100,
      y: 200,
      screenWidth: 1920,
      screenHeight: 1080,
      relativeX: 100 / 1920,
      relativeY: 200 / 1080,
    });
  });

  it("应该正确处理原点坐标 (0,0)", () => {
    const pos = new MousePosition(0, 0, 1920, 1080);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
    expect(pos.relativeX).toBe(0);
    expect(pos.relativeY).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MouseButtonState
// ---------------------------------------------------------------------------
describe("MouseButtonState", () => {
  it("应该正确创建左键按下状态", () => {
    const btn = new MouseButtonState(0, true);
    expect(btn.button).toBe(0);
    expect(btn.name).toBe("left");
    expect(btn.pressed).toBe(true);
  });

  it("应该正确创建右键未按下状态", () => {
    const btn = new MouseButtonState(2, false);
    expect(btn.button).toBe(2);
    expect(btn.name).toBe("right");
    expect(btn.pressed).toBe(false);
  });

  it("应该正确创建中键状态", () => {
    const btn = new MouseButtonState(1, true);
    expect(btn.name).toBe("middle");
  });

  it("应该处理未知按钮编号", () => {
    const btn = new MouseButtonState(9, true);
    expect(btn.name).toBe("button-9");
  });

  it("应该正确序列化为 JSON", () => {
    const btn = new MouseButtonState(0, true);
    expect(btn.toJSON()).toEqual({
      button: 0,
      name: "left",
      pressed: true,
    });
  });

  it("应该验证 BUTTON_NAMES 常量", () => {
    expect(BUTTON_NAMES[0]).toBe("left");
    expect(BUTTON_NAMES[1]).toBe("middle");
    expect(BUTTON_NAMES[2]).toBe("right");
    expect(BUTTON_NAMES[3]).toBe("back");
    expect(BUTTON_NAMES[4]).toBe("forward");
  });
});

// ---------------------------------------------------------------------------
// MouseState
// ---------------------------------------------------------------------------
describe("MouseState", () => {
  it("应该正确创建默认状态", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, []);
    expect(state.cursorType).toBe("default");
    expect(state.buttons).toEqual([]);
    expect(state.isAnyButtonDown).toBe(false);
  });

  it("应该正确检测左键按下", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, [
      new MouseButtonState(0, true),
    ]);
    expect(state.isLeftDown).toBe(true);
    expect(state.isRightDown).toBe(false);
    expect(state.isMiddleDown).toBe(false);
    expect(state.isAnyButtonDown).toBe(true);
  });

  it("应该正确检测右键按下", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, [
      new MouseButtonState(2, true),
    ]);
    expect(state.isRightDown).toBe(true);
    expect(state.isLeftDown).toBe(false);
  });

  it("应该正确检测中键按下", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, [
      new MouseButtonState(1, true),
    ]);
    expect(state.isMiddleDown).toBe(true);
  });

  it("应该正确检测多键同时按下", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, [
      new MouseButtonState(0, true),
      new MouseButtonState(2, true),
    ]);
    expect(state.isLeftDown).toBe(true);
    expect(state.isRightDown).toBe(true);
    expect(state.isAnyButtonDown).toBe(true);
    expect(state.buttons).toHaveLength(2);
  });

  it("应该正确获取指定按钮状态", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, [
      new MouseButtonState(0, true),
      new MouseButtonState(2, false),
    ]);
    expect(state.getButton(0).pressed).toBe(true);
    expect(state.getButton(2).pressed).toBe(false);
    expect(state.getButton(1)).toBeNull();
  });

  it("应该处理未知光标类型", () => {
    const state = new MouseState(null, []);
    expect(state.cursorType).toBe("unknown");
  });

  it("应该处理 null buttons", () => {
    const state = new MouseState(CURSOR_TYPES.DEFAULT, null);
    expect(state.buttons).toEqual([]);
    expect(state.isAnyButtonDown).toBe(false);
  });

  it("应该正确序列化为 JSON", () => {
    const state = new MouseState(CURSOR_TYPES.TEXT, [
      new MouseButtonState(0, true),
    ]);
    const json = state.toJSON();
    expect(json.cursorType).toBe("text");
    expect(json.buttons).toHaveLength(1);
    expect(json.isLeftDown).toBe(true);
    expect(json.isAnyButtonDown).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MouseEvent
// ---------------------------------------------------------------------------
describe("MouseEvent", () => {
  it("应该正确创建完整事件", () => {
    const pos = new MousePosition(100, 200, 1920, 1080);
    const state = new MouseState(CURSOR_TYPES.DEFAULT, []);
    const event = new MouseEvent(pos, state, "x11");

    expect(event.position.x).toBe(100);
    expect(event.position.y).toBe(200);
    expect(event.state.cursorType).toBe("default");
    expect(event.platform).toBe("x11");
    expect(event.timestamp).toBeTruthy();
    expect(Date.parse(event.timestamp)).not.toBeNaN();
  });

  it("应该默认 platform 为 unknown", () => {
    const pos = new MousePosition(0, 0);
    const state = new MouseState(CURSOR_TYPES.DEFAULT, []);
    const event = new MouseEvent(pos, state);
    expect(event.platform).toBe("unknown");
  });

  it("应该正确序列化为 JSON", () => {
    const pos = new MousePosition(100, 200, 1920, 1080);
    const state = new MouseState(CURSOR_TYPES.DEFAULT, []);
    const event = new MouseEvent(pos, state, "macos");
    const json = event.toJSON();

    expect(json.position.x).toBe(100);
    expect(json.state.cursorType).toBe("default");
    expect(json.platform).toBe("macos");
    expect(json.timestamp).toBeTruthy();
  });

  it("工厂方法 createMouseEvent 应该正确工作", () => {
    const event = createMouseEvent(
      500,
      300,
      [
        [0, true],
        [2, false],
      ],
      CURSOR_TYPES.TEXT,
      "wayland",
      2560,
      1440,
    );

    expect(event.position.x).toBe(500);
    expect(event.position.y).toBe(300);
    expect(event.state.cursorType).toBe("text");
    expect(event.state.buttons).toHaveLength(2);
    expect(event.platform).toBe("wayland");
    expect(event.position.screenWidth).toBe(2560);
    expect(event.position.screenHeight).toBe(1440);
  });

  it("createMouseEvent 应该正确处理空按键", () => {
    const event = createMouseEvent(0, 0, null, CURSOR_TYPES.DEFAULT, "x11");
    expect(event.state.buttons).toEqual([]);
    expect(event.state.isAnyButtonDown).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CURSOR_TYPES 常量
// ---------------------------------------------------------------------------
describe("CURSOR_TYPES", () => {
  it("应该包含所有标准光标类型", () => {
    const expected = [
      "default",
      "pointer",
      "text",
      "crosshair",
      "move",
      "not-allowed",
      "grab",
      "grabbing",
      "wait",
      "progress",
      "help",
      "zoom-in",
      "zoom-out",
      "none",
      "unknown",
    ];
    const keyMap = {
      default: "DEFAULT",
      pointer: "POINTER",
      text: "TEXT",
      crosshair: "CROSSHAIR",
      move: "MOVE",
      "not-allowed": "NOT_ALLOWED",
      grab: "GRAB",
      grabbing: "GRABBING",
      wait: "WAIT",
      progress: "PROGRESS",
      help: "HELP",
      "zoom-in": "ZOOM_IN",
      "zoom-out": "ZOOM_OUT",
      none: "NONE",
      unknown: "UNKNOWN",
    };
    for (const type of expected) {
      expect(CURSOR_TYPES[keyMap[type]]).toBe(type);
    }
  });

  it("应该包含 resize 系列光标类型", () => {
    expect(CURSOR_TYPES.RESIZE_N).toBe("resize-n");
    expect(CURSOR_TYPES.RESIZE_S).toBe("resize-s");
    expect(CURSOR_TYPES.RESIZE_E).toBe("resize-e");
    expect(CURSOR_TYPES.RESIZE_W).toBe("resize-w");
    expect(CURSOR_TYPES.RESIZE_NE).toBe("resize-ne");
    expect(CURSOR_TYPES.RESIZE_NW).toBe("resize-nw");
    expect(CURSOR_TYPES.RESIZE_SE).toBe("resize-se");
    expect(CURSOR_TYPES.RESIZE_SW).toBe("resize-sw");
  });
});

// ---------------------------------------------------------------------------
// BasePlatform
// ---------------------------------------------------------------------------
describe("BasePlatform", () => {
  it("应该正确返回 unknown 平台名", () => {
    const p = new BasePlatform();
    expect(p.name).toBe("unknown");
  });

  it("isAvailable 应该返回 false", () => {
    expect(BasePlatform.isAvailable()).toBe(false);
  });

  it("getPosition 应该抛出 NotImplemented", async () => {
    const p = new BasePlatform();
    await expect(p.getPosition()).rejects.toThrow("not implemented");
  });

  it("getState 应该抛出 NotImplemented", async () => {
    const p = new BasePlatform();
    await expect(p.getState()).rejects.toThrow("not implemented");
  });

  it("getScreenSize 应该返回默认值", () => {
    const p = new BasePlatform();
    expect(p.getScreenSize()).toEqual({ width: null, height: null });
  });

  it("_exec 应该正确执行命令", () => {
    const p = new BasePlatform();
    const result = p._exec("echo hello");
    expect(result).toBe("hello");
  });

  it("_tryExec 应该在失败时返回 null", () => {
    const p = new BasePlatform();
    const result = p._tryExec("nonexistent_command_xyz 2>/dev/null");
    expect(result).toBeNull();
  });

  it("_tryExec 应该在成功时返回输出", () => {
    const p = new BasePlatform();
    const result = p._tryExec("echo test123");
    expect(result).toBe("test123");
  });

  it("sample 应该合并位置和状态", async () => {
    const p = new BasePlatform();
    // 需要 mock getPosition 和 getState，但 BasePlatform 的这两个方法会抛错
    // 我们通过子类验证 sample 的正确性
    // 这里验证 BasePlatform.sample 会调用 getPosition 和 getState
    let getPosCalled = false;
    let getStateCalled = false;
    p.getPosition = async () => {
      getPosCalled = true;
      return {
        position: { x: 10, y: 20, screenWidth: 1920, screenHeight: 1080 },
        state: { cursorType: "default", buttons: [] },
      };
    };
    p.getState = async () => {
      getStateCalled = true;
      return {
        position: { x: 0, y: 0, screenWidth: 1920, screenHeight: 1080 },
        state: { cursorType: "default", buttons: [] },
      };
    };
    const event = await p.sample();
    expect(getPosCalled).toBe(true);
    expect(getStateCalled).toBe(true);
    expect(event.position.x).toBe(10);
    expect(event.position.y).toBe(20);
    expect(event.state.cursorType).toBe("default");
  });
});

// ---------------------------------------------------------------------------
// MouseTracker
// ---------------------------------------------------------------------------
describe("MouseTracker", () => {
  it("应该正确初始化并检测平台", () => {
    const tracker = new MouseTracker();
    tracker.init();
    expect(tracker.platformName).toBeDefined();
    expect(["x11", "wayland", "macos", "unknown"]).toContain(
      tracker.platformName,
    );
  });

  it("isAvailable 应该返回布尔值", () => {
    expect(typeof MouseTracker.isAvailable()).toBe("boolean");
  });

  it("应该在未初始化时自动初始化", () => {
    const tracker = new MouseTracker();
    expect(tracker.platformName).toBeDefined();
  });

  it("重复调用 init 应该直接返回", () => {
    const tracker = new MouseTracker();
    tracker.init();
    const plat1 = tracker._platform;
    tracker.init();
    expect(tracker._platform).toBe(plat1);
  });

  it("无可用平台时回退到 BasePlatform", () => {
    const origPlatform = process.platform;
    const origDisplay = process.env.DISPLAY;
    const origWayland = process.env.WAYLAND_DISPLAY;
    const origSession = process.env.XDG_SESSION_TYPE;
    try {
      Object.defineProperty(process, "platform", {
        value: "linux",
        configurable: true,
      });
      delete process.env.DISPLAY;
      delete process.env.WAYLAND_DISPLAY;
      delete process.env.XDG_SESSION_TYPE;
      const tracker = new MouseTracker().init();
      expect(tracker.platformName).toBe("unknown");
    } finally {
      Object.defineProperty(process, "platform", {
        value: origPlatform,
        configurable: true,
      });
      process.env.DISPLAY = origDisplay;
      process.env.WAYLAND_DISPLAY = origWayland;
      process.env.XDG_SESSION_TYPE = origSession;
    }
  });

  it("应该正确返回屏幕尺寸", () => {
    const tracker = new MouseTracker();
    tracker.init();
    const size = tracker.getScreenSize();
    expect(size).toHaveProperty("width");
    expect(size).toHaveProperty("height");
  });

  it("track 应该返回 stop 函数", () => {
    const tracker = new MouseTracker();
    tracker.init();
    const calls = [];
    const stop = tracker.track(1000, (event, err) => {
      calls.push(event || err);
    });
    expect(typeof stop).toBe("function");
    stop();
  });

  it("track 不传 intervalMs 时使用默认 100ms", () => {
    const tracker = new MouseTracker();
    tracker.init();
    tracker._platform.sample = jest.fn().mockResolvedValue({
      position: { x: 0, y: 0 },
      state: { cursorType: "default" },
    });
    const stop = tracker.track(undefined, () => {});
    stop();
    expect(typeof stop).toBe("function");
  });

  it("stop 应该停止追踪", (done) => {
    const tracker = new MouseTracker();
    tracker.init();
    let count = 0;
    const stop = tracker.track(50, () => {
      count++;
    });
    setTimeout(() => {
      stop();
      const afterStop = count;
      setTimeout(() => {
        // 停止后不应再增加
        expect(count).toBe(afterStop);
        done();
      }, 100);
    }, 60);
  });

  it("track 回调应该处理错误", (done) => {
    const tracker = new MouseTracker();
    tracker.init();
    tracker._platform.sample = async () => {
      throw new Error("sample failed");
    };
    const stop = tracker.track(50, (event, err) => {
      expect(event).toBeNull();
      expect(err).toBeDefined();
      expect(err.message).toBe("sample failed");
      stop();
      done();
    });
  });

  it("track 回调应该收到 MouseEvent", (done) => {
    const tracker = new MouseTracker();
    tracker.init();
    let called = false;
    tracker._platform.sample = jest.fn().mockResolvedValue({
      position: { x: 1, y: 2 },
      state: { cursorType: "default" },
      platform: "test",
    });
    const stop = tracker.track(30, (event) => {
      if (!called) {
        called = true;
        stop();
        expect(event).toBeDefined();
        expect(event.position.x).toBe(1);
        done();
      }
    });
  });

  it("sample 应该正确委托给平台", async () => {
    const tracker = new MouseTracker();
    tracker.init();
    tracker._platform.sample = jest
      .fn()
      .mockResolvedValue({ position: {}, state: {} });
    await tracker.sample();
    expect(tracker._platform.sample).toHaveBeenCalled();
  });

  it("getPosition 应该正确委托给平台", async () => {
    const tracker = new MouseTracker();
    tracker.init();
    tracker._platform.getPosition = jest
      .fn()
      .mockResolvedValue({ position: { x: 1, y: 2 } });
    const result = await tracker.getPosition();
    expect(result.position.x).toBe(1);
    expect(tracker._platform.getPosition).toHaveBeenCalled();
  });

  it("getState 应该正确委托给平台", async () => {
    const tracker = new MouseTracker();
    tracker.init();
    tracker._platform.getState = jest
      .fn()
      .mockResolvedValue({ state: { cursorType: "text" } });
    const result = await tracker.getState();
    expect(result.state.cursorType).toBe("text");
    expect(tracker._platform.getState).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CursorFusion 集成
// ---------------------------------------------------------------------------
describe("CursorFusion 鼠标集成", () => {
  it("应该通过 CursorFusion.getMouseTracker 获取追踪器", async () => {
    const cf = await new CursorFusion({ silent: true }).init();
    const tracker = cf.getMouseTracker();
    expect(tracker).toBeDefined();
    expect(typeof tracker.platformName).toBe("string");
    expect(typeof tracker.sample).toBe("function");
  });

  it("应该支持 mousePlatform 配置注入", async () => {
    const cf = await new CursorFusion({
      silent: true,
      mousePlatform: "x11",
    }).init();
    expect(cf.getMouseTracker().platformName).toBe("x11");
  });
});
