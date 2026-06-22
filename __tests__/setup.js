// 全局测试设置
beforeEach(() => {
  // 重置所有 mock
  jest.restoreAllMocks();
});

// 全局超时
jest.setTimeout(10000);
