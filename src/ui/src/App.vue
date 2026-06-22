<template>
  <div id="app">
    <header>
      <h1>CursorFusion</h1>
      <span class="version">v{{ version }}</span>
    </header>
    <main>
      <StatusPanel
        :platform="platform"
        :mousePosition="mousePosition"
        :mouseState="mouseState"
      />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import StatusPanel from './components/StatusPanel.vue';

const version = ref('0.1.0-alpha.1');
const platform = ref('unknown');
const mousePosition = ref({ x: 0, y: 0 });
const mouseState = ref({ cursorType: 'default', buttons: [] });

let stopTracking = null;
let bridge = null;

onMounted(async () => {
  try {
    // 动态加载桥接模块
    bridge = await import('/bridge/index.js');
    platform.value = bridge.getPlatformName();
    stopTracking = bridge.startTracking(100, (event) => {
      if (event) {
        mousePosition.value = event.position;
        mouseState.value = event.state;
      }
    });
  } catch (e) {
    console.warn('Bridge not available, running in UI-only mode');
  }
});

onUnmounted(() => {
  if (stopTracking) stopTracking();
});
</script>

<style>
:root {
  --bg: #1a1a2e;
  --surface: #16213e;
  --text: #e0e0e0;
  --accent: #0f3460;
  --highlight: #e94560;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}
#app {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px;
}
header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--accent);
}
header h1 { font-size: 28px; font-weight: 700; }
.version { color: #888; font-size: 14px; }
</style>