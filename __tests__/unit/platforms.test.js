/**
 * 平台实现单元测试 —— 通过 mock child_process.execSync 覆盖所有平台代码路径。
 */
const { X11Platform } = require("../../src/core/mouse/platforms/x11");
const { WaylandPlatform } = require("../../src/core/mouse/platforms/wayland");
const { MacOSPlatform } = require("../../src/core/mouse/platforms/macos");
const { CURSOR_TYPES } = require("../../src/core/mouse/types");

// execSync mock
const mockExec = jest.fn();
jest.mock("child_process", () => ({
  execSync: (...args) => mockExec(...args),
}));

// 保存原始 platform
const origPlatform = process.platform;
const origEnv = { ...process.env };

function setPlatform(platform) {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

function setEnv(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === null) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
}

function resetEnv() {
  Object.defineProperty(process, "platform", {
    value: origPlatform,
    configurable: true,
  });
  process.env = { ...origEnv };
}

beforeEach(() => {
  mockExec.mockReset();
  setPlatform("linux");
  setEnv({ DISPLAY: ":0", WAYLAND_DISPLAY: null, XDG_SESSION_TYPE: null });
});

afterEach(resetEnv);

// ---------------------------------------------------------------------------
// X11Platform
// ---------------------------------------------------------------------------
describe("X11Platform", () => {
  describe("isAvailable", () => {
    it("Linux + DISPLAY 时可用", () => {
      setPlatform("linux");
      setEnv({ DISPLAY: ":0" });
      expect(X11Platform.isAvailable()).toBe(true);
    });

    it("Linux 无 DISPLAY 时不可用", () => {
      setPlatform("linux");
      setEnv({ DISPLAY: null });
      expect(X11Platform.isAvailable()).toBe(false);
    });

    it("FreeBSD + DISPLAY 时可用", () => {
      setPlatform("freebsd");
      setEnv({ DISPLAY: ":1" });
      expect(X11Platform.isAvailable()).toBe(true);
    });

    it("macOS 上不可用", () => {
      setPlatform("darwin");
      setEnv({ DISPLAY: ":0" });
      expect(X11Platform.isAvailable()).toBe(false);
    });
  });

  describe("getScreenSize", () => {
    it("应该从 xdpyinfo 解析尺寸", () => {
      const p = new X11Platform();
      mockExec.mockReturnValueOnce(
        "screen #0:\n  dimensions:    1920x1080 pixels (508x285 millimeters)",
      );
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it("xdpyinfo 返回非匹配内容时跳过", () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("screen #0:\n  no dimensions here")
        .mockReturnValueOnce("3840x2160");
      const size = p.getScreenSize();
      expect(size.width).toBe(3840);
      expect(size.height).toBe(2160);
    });

    it("应该缓存屏幕尺寸", () => {
      const p = new X11Platform();
      mockExec.mockReturnValueOnce(
        "screen #0:\n  dimensions:    2560x1440 pixels",
      );
      p.getScreenSize();
      const size = p.getScreenSize();
      expect(size.width).toBe(2560);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it("xdpyinfo 失败时回退到 xrandr", () => {
      const p = new X11Platform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no xdpyinfo");
        })
        .mockReturnValueOnce("3840x2160");
      const size = p.getScreenSize();
      expect(size.width).toBe(3840);
      expect(size.height).toBe(2160);
    });
  });

  describe("getPosition", () => {
    it("应该正确解析 xdotool 输出", async () => {
      const p = new X11Platform();
      // getPosition 先调 xdotool，再调 getScreenSize → xdpyinfo
      mockExec
        .mockReturnValueOnce("X=640\nY=480\nSCREEN=0\nWINDOW=12345")
        .mockReturnValueOnce("screen #0:\n  dimensions:    1920x1080 pixels");
      const event = await p.getPosition();
      expect(event.position.x).toBe(640);
      expect(event.position.y).toBe(480);
      expect(event.position.screenWidth).toBe(1920);
      expect(event.position.screenHeight).toBe(1080);
      expect(event.platform).toBe("x11");
    });

    it("xdotool 返回空输出时使用 (0,0)", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("")
        .mockReturnValueOnce("screen #0:\n  dimensions:    1920x1080 pixels");
      const event = await p.getPosition();
      expect(event.position.x).toBe(0);
      expect(event.position.y).toBe(0);
    });
  });

  describe("getState", () => {
    it("xinput 可用时检测按键状态", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce(
          "Virtual core pointer  id=2  [slave  pointer  (2)]",
        )
        .mockReturnValueOnce(
          "button[1]=up\nbutton[left]=down\nbutton[right]=up\nbutton[middle]=up",
        );
      const event = await p.getState();
      expect(event.state.isLeftDown).toBe(true);
      expect(event.state.isRightDown).toBe(false);
    });

    it("xinput 不可用时回退", async () => {
      const p = new X11Platform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no xinput");
        })
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
      expect(event.state.buttons).toEqual([]);
    });

    it("xinput query-state 失败时回退", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockImplementationOnce(() => {
          throw new Error("no query-state");
        })
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
      expect(event.state.buttons).toEqual([]);
    });

    it("xset 检测到光标隐藏时返回 NONE", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce(
          "Virtual core pointer  id=2  [slave  pointer  (2)]",
        )
        .mockReturnValueOnce("button[left]=up")
        .mockReturnValueOnce(
          "Keyboard Control:\n  auto repeat:  on\n  Cursor  off",
        );
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.NONE);
    });
  });

  describe("_detectCursorType", () => {
    it("xprop 返回 TEXT 光标名时检测为 TEXT", async () => {
      const p = new X11Platform();
      // getState → _findPointerId → xinput list → _detectCursorType
      // _detectCursorType: xset q → xdotool getactivewindow → xprop
      mockExec
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockReturnValueOnce("button[left]=up")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on")
        .mockReturnValueOnce("12345")
        .mockReturnValueOnce("ibeam");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.TEXT);
    });

    it("xprop 返回 WAIT 光标名时检测为 WAIT", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockReturnValueOnce("button[left]=up")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on")
        .mockReturnValueOnce("12345")
        .mockReturnValueOnce("watch");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.WAIT);
    });

    it("xprop 返回 POINTER 光标名时检测为 POINTER", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockReturnValueOnce("button[left]=up")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on")
        .mockReturnValueOnce("12345")
        .mockReturnValueOnce("hand2");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.POINTER);
    });

    it("_findPointerId 无匹配时返回 null", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("No pointer devices found")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on");
      const event = await p.getState();
      expect(event.state.buttons).toEqual([]);
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });

    it("xprop 返回空时使用 DEFAULT", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockReturnValueOnce("button[left]=up")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on")
        .mockReturnValueOnce("12345")
        .mockReturnValueOnce("");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });

    it("xprop 返回未知光标名时使用 DEFAULT", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockReturnValueOnce("button[left]=up")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on")
        .mockReturnValueOnce("12345")
        .mockReturnValueOnce("some_unknown_cursor");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });
  });

  describe("sample (继承自 BasePlatform)", () => {
    it("应该合并 getPosition 和 getState 结果", async () => {
      const p = new X11Platform();
      mockExec
        .mockReturnValueOnce("X=100\nY=200\nSCREEN=0\nWINDOW=12345")
        .mockReturnValueOnce("screen #0:\n  dimensions:    1920x1080 pixels")
        .mockReturnValueOnce("Virtual core pointer  id=2  [slave  pointer  (2)]")
        .mockReturnValueOnce("button[left]=down")
        .mockReturnValueOnce("Keyboard Control:\n  auto repeat:  on");
      const event = await p.sample();
      expect(event.position.x).toBe(100);
      expect(event.position.y).toBe(200);
      expect(event.state.isLeftDown).toBe(true);
      expect(event.platform).toBe("x11");
    });
  });

  describe("name", () => {
    it("name 为 x11", () => {
      expect(new X11Platform().name).toBe("x11");
    });
  });
});

// ---------------------------------------------------------------------------
// WaylandPlatform
// ---------------------------------------------------------------------------
describe("WaylandPlatform", () => {
  describe("isAvailable", () => {
    it("Linux + WAYLAND_DISPLAY 时可用", () => {
      setPlatform("linux");
      setEnv({ WAYLAND_DISPLAY: "wayland-0", DISPLAY: null });
      expect(WaylandPlatform.isAvailable()).toBe(true);
    });

    it("Linux + XDG_SESSION_TYPE=wayland 时可用", () => {
      setPlatform("linux");
      setEnv({ WAYLAND_DISPLAY: null, XDG_SESSION_TYPE: "wayland" });
      expect(WaylandPlatform.isAvailable()).toBe(true);
    });

    it("无 Wayland 环境变量时不可用", () => {
      setPlatform("linux");
      setEnv({ WAYLAND_DISPLAY: null, XDG_SESSION_TYPE: null });
      expect(WaylandPlatform.isAvailable()).toBe(false);
    });

    it("macOS 上不可用", () => {
      setPlatform("darwin");
      setEnv({ WAYLAND_DISPLAY: "wayland-0" });
      expect(WaylandPlatform.isAvailable()).toBe(false);
    });
  });

  describe("getScreenSize", () => {
    it("wlr-randr 解析尺寸", () => {
      const p = new WaylandPlatform();
      mockExec.mockReturnValueOnce("DP-1 1920x1080 px, 60.000000 Hz");
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it("应该缓存屏幕尺寸", () => {
      const p = new WaylandPlatform();
      mockExec.mockReturnValueOnce("DP-1 2560x1440 px");
      p.getScreenSize();
      const size = p.getScreenSize();
      expect(size.width).toBe(2560);
      expect(size.height).toBe(1440);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it("wlr-randr 返回非匹配内容时跳过", () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("No outputs available")
        .mockReturnValueOnce(
          JSON.stringify([
            { active: true, current_mode: { width: 1920, height: 1080 } },
          ]),
        );
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it("wlr-randr 失败时回退到 swaymsg", () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no wlr-randr");
        })
        .mockReturnValueOnce(
          JSON.stringify([
            {
              active: true,
              current_mode: { width: 2560, height: 1440 },
            },
          ]),
        );
      const size = p.getScreenSize();
      expect(size.width).toBe(2560);
      expect(size.height).toBe(1440);
    });

    it("swaymsg 返回无活跃输出时回退到 hyprctl", () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no wlr-randr");
        })
        .mockReturnValueOnce(
          JSON.stringify([{ active: false, current_mode: { width: 800, height: 600 } }]),
        )
        .mockReturnValueOnce(JSON.stringify([{ width: 1920, height: 1080 }]));
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it("swaymsg 失败时回退到 hyprctl", () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no wlr-randr");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockReturnValueOnce(JSON.stringify([{ width: 3440, height: 1440 }]));
      const size = p.getScreenSize();
      expect(size.width).toBe(3440);
      expect(size.height).toBe(1440);
    });

    it("hyprctl 返回空数组时使用默认尺寸", () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no wlr-randr");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockReturnValueOnce("[]");
      const size = p.getScreenSize();
      expect(size.width).toBeNull();
      expect(size.height).toBeNull();
    });

    it("hyprctl 失败时使用默认尺寸", () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no wlr-randr");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockImplementationOnce(() => {
          throw new Error("no hyprctl");
        });
      const size = p.getScreenSize();
      expect(size.width).toBeNull();
      expect(size.height).toBeNull();
    });
  });

  describe("getPosition", () => {
    it("ydotool 可用时获取位置", async () => {
      const p = new WaylandPlatform();
      // getScreenSize → wlr-randr, then ydotool
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockReturnValueOnce("500,300");
      const event = await p.getPosition();
      expect(event.position.x).toBe(500);
      expect(event.position.y).toBe(300);
      expect(event.platform).toBe("wayland");
    });

    it("ydotool 返回非匹配内容时跳过", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockReturnValueOnce("invalid output")
        .mockReturnValueOnce(JSON.stringify({ type: "root", focus: [{ type: "pointer", x: 800, y: 600 }] }));
      const event = await p.getPosition();
      expect(event.position.x).toBe(800);
      expect(event.position.y).toBe(600);
    });

    it("ydotool 失败时回退到 swaymsg", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [],
        focus: [
          {
            type: "pointer",
            x: 800,
            y: 600,
          },
        ],
      };
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getPosition();
      expect(event.position.x).toBe(800);
      expect(event.position.y).toBe(600);
    });

    it("swaymsg 失败时回退到 hyprctl", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockReturnValueOnce("1234, 567");
      const event = await p.getPosition();
      expect(event.position.x).toBe(1234);
      expect(event.position.y).toBe(567);
    });

    it("所有方法失败时返回 (0,0)", async () => {
      const p = new WaylandPlatform();
      mockExec.mockImplementation(() => {
        throw new Error("nothing works");
      });
      const event = await p.getPosition();
      expect(event.position.x).toBe(0);
      expect(event.position.y).toBe(0);
    });

    it("swaymsg 无 pointer 时回退到 hyprctl", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce(
          JSON.stringify({ type: "root", nodes: [{ type: "output", name: "DP-1" }] }),
        )
        .mockReturnValueOnce("800, 600");
      const event = await p.getPosition();
      expect(event.position.x).toBe(800);
      expect(event.position.y).toBe(600);
    });

    it("swaymsg pointer 无 x/y 时使用 0", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce(
          JSON.stringify({ type: "root", focus: [{ type: "pointer" }] }),
        );
      const event = await p.getPosition();
      expect(event.position.x).toBe(0);
      expect(event.position.y).toBe(0);
    });

    it("hyprctl 返回非匹配内容时回退到 libinput", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockReturnValueOnce("invalid format")
        .mockReturnValueOnce("event3  POINTER_MOTION_ABSOLUTE    0.50/0.50");
      const event = await p.getPosition();
      expect(event.position.x).toBe(960);
      expect(event.position.y).toBe(540);
    });

    it("libinput 返回非匹配内容时使用 (0,0)", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockImplementationOnce(() => {
          throw new Error("no hyprctl");
        })
        .mockReturnValueOnce("no match here");
      const event = await p.getPosition();
      expect(event.position.x).toBe(0);
      expect(event.position.y).toBe(0);
    });

    it("libinput 回退（绝对坐标）", async () => {
      const p = new WaylandPlatform();
      // getScreenSize → wlr-randr, then ydotool/sway/hypr all fail, libinput succeeds
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no swaymsg");
        })
        .mockImplementationOnce(() => {
          throw new Error("no hyprctl");
        })
        .mockReturnValueOnce("event3  POINTER_MOTION_ABSOLUTE    0.50/0.50");
      const event = await p.getPosition();
      expect(event.position.x).toBe(960);
      expect(event.position.y).toBe(540);
    });
  });

  describe("getState", () => {
    it("应该返回默认状态（无 swaymsg）", async () => {
      const p = new WaylandPlatform();
      mockExec.mockImplementation(() => {
        throw new Error("nothing");
      });
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });

    it("swaymsg 检测到终端时返回 TEXT 光标", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [
          {
            app_id: "gnome-terminal",
            name: "gnome-terminal",
            focused: true,
          },
        ],
      };
      // getState: ydotool(1) + libinput(2) + swaymsg(3)
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no libinput");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.TEXT);
    });

    it("通过 name 包含 'code' 检测编辑器为 TEXT", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [
          {
            app_id: "code",
            name: "Visual Studio Code",
            focused: true,
          },
        ],
      };
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no libinput");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.TEXT);
    });

    it("swaymsg 检测到浏览器时返回 POINTER 光标", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [
          {
            app_id: "chromium-browser",
            name: "Chromium",
            focused: true,
          },
        ],
      };
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no libinput");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.POINTER);
    });

    it("聚焦节点无 app_id 时使用空字符串", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [
          {
            name: "some-app",
            focused: true,
          },
        ],
      };
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no libinput");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });

    it("聚焦节点无 name 时使用空字符串", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [
          {
            app_id: "my-app",
            focused: true,
          },
        ],
      };
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no libinput");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });
  });

  describe("libinput 按键检测", () => {
    it("libinput 检测到 BTN_LEFT pressed", async () => {
      const p = new WaylandPlatform();
      // getState: ydotool(1) → libinput(2) → swaymsg(3)
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce("BTN_LEFT pressed")
        .mockReturnValueOnce(JSON.stringify({ type: "root", nodes: [] }));
      const event = await p.getState();
      expect(event.state.isLeftDown).toBe(true);
    });

    it("libinput 检测到 BTN_RIGHT pressed", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce("BTN_RIGHT pressed")
        .mockReturnValueOnce(JSON.stringify({ type: "root", nodes: [] }));
      const event = await p.getState();
      expect(event.state.isRightDown).toBe(true);
    });

    it("libinput 检测到 BTN_MIDDLE pressed", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce("BTN_MIDDLE pressed")
        .mockReturnValueOnce(JSON.stringify({ type: "root", nodes: [] }));
      const event = await p.getState();
      expect(event.state.isMiddleDown).toBe(true);
    });

    it("ydotool 返回内容时执行空块", async () => {
      const p = new WaylandPlatform();
      mockExec
        .mockReturnValueOnce("some ydotool state")
        .mockReturnValueOnce("BTN_LEFT pressed")
        .mockReturnValueOnce(JSON.stringify({ type: "root", nodes: [] }));
      const event = await p.getState();
      expect(event.state.isLeftDown).toBe(true);
    });
  });

  describe("_findSeatRecursive", () => {
    it("应该在 nodes 中递归查找 pointer", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [
          {
            type: "container",
            nodes: [
              {
                type: "pointer",
                x: 123,
                y: 456,
              },
            ],
          },
        ],
      };
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getPosition();
      expect(event.position.x).toBe(123);
      expect(event.position.y).toBe(456);
    });

    it("应该在 focus 数组中查找 pointer", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        focus: [
          { type: "container" },
          { type: "pointer", x: 200, y: 300 },
        ],
      };
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getPosition();
      expect(event.position.x).toBe(200);
      expect(event.position.y).toBe(300);
    });

    it("无匹配时应返回 null", () => {
      const p = new WaylandPlatform();
      const result = p._findSeatRecursive(
        { type: "container", nodes: [] },
        "pointer",
      );
      expect(result).toBeNull();
    });

    it("null 节点应返回 null", () => {
      const p = new WaylandPlatform();
      expect(p._findSeatRecursive(null, "pointer")).toBeNull();
    });

    it("无 nodes 属性时返回 null", () => {
      const p = new WaylandPlatform();
      expect(p._findSeatRecursive({ type: "container" }, "pointer")).toBeNull();
    });
  });

  describe("_findFocusedNode", () => {
    it("应该在 floating_nodes 中递归查找聚焦节点", async () => {
      const p = new WaylandPlatform();
      const tree = {
        type: "root",
        nodes: [],
        floating_nodes: [
          {
            app_id: "gnome-terminal",
            name: "gnome-terminal",
            focused: true,
          },
        ],
      };
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockImplementationOnce(() => {
          throw new Error("no libinput");
        })
        .mockReturnValueOnce(JSON.stringify(tree));
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.TEXT);
    });

    it("应该在 nodes 中递归查找聚焦节点", () => {
      const p = new WaylandPlatform();
      const result = p._findFocusedNode({
        type: "root",
        nodes: [
          { type: "container", nodes: [{ app_id: "test", focused: true }] },
        ],
      });
      expect(result).toEqual({ app_id: "test", focused: true });
    });

    it("无聚焦节点时返回 null", () => {
      const p = new WaylandPlatform();
      const result = p._findFocusedNode({ type: "root", nodes: [] });
      expect(result).toBeNull();
    });

    it("null 节点返回 null", () => {
      const p = new WaylandPlatform();
      expect(p._findFocusedNode(null)).toBeNull();
    });

    it("无 nodes 和 floating_nodes 时返回 null", () => {
      const p = new WaylandPlatform();
      expect(p._findFocusedNode({ type: "container" })).toBeNull();
    });

    it("应该跳过 nodes 中未聚焦节点继续查找", () => {
      const p = new WaylandPlatform();
      const result = p._findFocusedNode({
        type: "root",
        nodes: [
          { type: "container", nodes: [] },
          { focused: true, app_id: "target" },
        ],
      });
      expect(result).toEqual({ focused: true, app_id: "target" });
    });

    it("应该跳过 floating_nodes 中未聚焦节点继续查找", () => {
      const p = new WaylandPlatform();
      const result = p._findFocusedNode({
        type: "root",
        nodes: [],
        floating_nodes: [
          { type: "container" },
          { focused: true, app_id: "target" },
        ],
      });
      expect(result).toEqual({ focused: true, app_id: "target" });
    });
  });

  describe("name", () => {
    it("name 为 wayland", () => {
      expect(new WaylandPlatform().name).toBe("wayland");
    });
  });

  describe("sample (继承自 BasePlatform)", () => {
    it("应该合并 getPosition 和 getState 结果", async () => {
      const p = new WaylandPlatform();
      // getScreenSize → wlr-randr, then ydotool for position, then ydotool/libinput/swaymsg for state
      mockExec
        .mockReturnValueOnce("DP-1 1920x1080 px")
        .mockReturnValueOnce("500,300")
        .mockImplementationOnce(() => {
          throw new Error("no ydotool");
        })
        .mockReturnValueOnce("BTN_LEFT pressed")
        .mockReturnValueOnce(JSON.stringify({ type: "root", nodes: [] }));
      const event = await p.sample();
      expect(event.position.x).toBe(500);
      expect(event.position.y).toBe(300);
      expect(event.state.isLeftDown).toBe(true);
      expect(event.platform).toBe("wayland");
    });
  });
});

// ---------------------------------------------------------------------------
// MacOSPlatform
// ---------------------------------------------------------------------------
describe("MacOSPlatform", () => {
  beforeEach(() => {
    setPlatform("darwin");
    setEnv({ DISPLAY: null, WAYLAND_DISPLAY: null });
  });

  describe("isAvailable", () => {
    it("macOS 上可用", () => {
      expect(MacOSPlatform.isAvailable()).toBe(true);
    });

    it("Linux 上不可用", () => {
      setPlatform("linux");
      expect(MacOSPlatform.isAvailable()).toBe(false);
    });
  });

  describe("getScreenSize", () => {
    it("osascript Finder 方式获取尺寸", () => {
      const p = new MacOSPlatform();
      mockExec.mockReturnValueOnce("1920x1080");
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it("应该缓存屏幕尺寸", () => {
      const p = new MacOSPlatform();
      mockExec.mockReturnValueOnce("1920x1080");
      p.getScreenSize();
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
      expect(mockExec).toHaveBeenCalledTimes(1);
    });

    it("osascript 返回非匹配内容时回退到 system_profiler", () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("no dimensions")
        .mockReturnValueOnce("Displays:\n    Resolution: 1920 x 1080 Retina");
      const size = p.getScreenSize();
      expect(size.width).toBe(1920);
      expect(size.height).toBe(1080);
    });

    it("osascript 失败时回退到 system_profiler", () => {
      const p = new MacOSPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no osascript");
        })
        .mockReturnValueOnce("Displays:\n    Resolution: 2560 x 1440 Retina");
      const size = p.getScreenSize();
      expect(size.width).toBe(2560);
      expect(size.height).toBe(1440);
    });

    it("system_profiler 返回非匹配内容时使用 null", () => {
      const p = new MacOSPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no osascript");
        })
        .mockReturnValueOnce("Displays:\n    No resolution info");
      const size = p.getScreenSize();
      expect(size.width).toBeNull();
      expect(size.height).toBeNull();
    });

    it("system_profiler 和 osascript 都失败时使用 null", () => {
      const p = new MacOSPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no osascript");
        })
        .mockImplementationOnce(() => {
          throw new Error("no system_profiler");
        });
      const size = p.getScreenSize();
      expect(size.width).toBeNull();
      expect(size.height).toBeNull();
    });
  });

  describe("getPosition", () => {
    it("JXA 方式获取位置", async () => {
      const p = new MacOSPlatform();
      mockExec.mockReturnValueOnce("1920x1080").mockReturnValueOnce("500,300");
      const event = await p.getPosition();
      expect(event.position.x).toBe(500);
      expect(event.position.y).toBe(300);
      expect(event.platform).toBe("macos");
    });

    it("JXA 返回无效坐标时使用 0", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("1920x1080")
        .mockReturnValueOnce("abc,def")
        .mockReturnValueOnce("800, 600");
      const event = await p.getPosition();
      expect(event.position.x).toBe(800);
      expect(event.position.y).toBe(600);
    });

    it("JXA 和 fallback 都失败时返回 (0,0)", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("1920x1080")
        .mockImplementationOnce(() => {
          throw new Error("no JXA");
        })
        .mockImplementationOnce(() => {
          throw new Error("no fallback");
        });
      const event = await p.getPosition();
      expect(event.position.x).toBe(0);
      expect(event.position.y).toBe(0);
    });

    it("fallback 返回非匹配内容时使用 (0,0)", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("1920x1080")
        .mockImplementationOnce(() => {
          throw new Error("no JXA");
        })
        .mockReturnValueOnce("invalid position");
      const event = await p.getPosition();
      expect(event.position.x).toBe(0);
      expect(event.position.y).toBe(0);
    });
  });

  describe("getState", () => {
    it("无法获取前台应用时返回 DEFAULT", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:0|RIGHT:0|CENTER:0")
        .mockImplementationOnce(() => {
          throw new Error("no front app");
        });
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });

    it("应该检测按键状态", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:1|RIGHT:0|CENTER:0")
        .mockReturnValueOnce("Safari");
      const event = await p.getState();
      expect(event.state.isLeftDown).toBe(true);
      expect(event.state.isRightDown).toBe(false);
      expect(event.state.cursorType).toBe(CURSOR_TYPES.POINTER);
    });

    it("后端应用检测到终端时返回 TEXT 光标", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:0|RIGHT:0|CENTER:0")
        .mockReturnValueOnce("iTerm2");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.TEXT);
    });

    it("后端应用检测到 VSCode 时返回 TEXT 光标", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:0|RIGHT:0|CENTER:0")
        .mockReturnValueOnce("Code");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.TEXT);
    });

    it("非文本/浏览器应用返回 DEFAULT", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:0|RIGHT:0|CENTER:0")
        .mockReturnValueOnce("Finder");
      const event = await p.getState();
      expect(event.state.cursorType).toBe(CURSOR_TYPES.DEFAULT);
    });

    it("按钮状态获取失败时不报错", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockImplementationOnce(() => {
          throw new Error("no CGEvent");
        })
        .mockReturnValueOnce("Terminal");
      const event = await p.getState();
      expect(event.state.buttons).toEqual([]);
    });

    it("应该检测右键按下状态", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:0|RIGHT:1|CENTER:0")
        .mockReturnValueOnce("Finder");
      const event = await p.getState();
      expect(event.state.isRightDown).toBe(true);
      expect(event.state.isLeftDown).toBe(false);
    });

    it("应该检测中键按下状态", async () => {
      const p = new MacOSPlatform();
      mockExec
        .mockReturnValueOnce("LEFT:0|RIGHT:0|CENTER:1")
        .mockReturnValueOnce("Finder");
      const event = await p.getState();
      expect(event.state.isMiddleDown).toBe(true);
    });
  });

  describe("name", () => {
    it("name 为 macos", () => {
      expect(new MacOSPlatform().name).toBe("macos");
    });
  });

  describe("sample (继承自 BasePlatform)", () => {
    it("应该合并 getPosition 和 getState 结果", async () => {
      const p = new MacOSPlatform();
      // getScreenSize → osascript, then JXA position, then button state + frontapp
      mockExec
        .mockReturnValueOnce("1920x1080")
        .mockReturnValueOnce("500,300")
        .mockReturnValueOnce("LEFT:1|RIGHT:0|CENTER:0")
        .mockReturnValueOnce("Safari");
      const event = await p.sample();
      expect(event.position.x).toBe(500);
      expect(event.position.y).toBe(300);
      expect(event.state.isLeftDown).toBe(true);
      expect(event.platform).toBe("macos");
    });
  });
});
