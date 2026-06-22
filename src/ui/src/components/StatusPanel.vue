<template>
  <div class="status-panel">
    <div class="card">
      <h3>Platform</h3>
      <span class="value">{{ platform }}</span>
    </div>
    <div class="card">
      <h3>Position</h3>
      <span class="value">({{ mousePosition.x }}, {{ mousePosition.y }})</span>
    </div>
    <div class="card">
      <h3>Cursor</h3>
      <span class="value">{{ mouseState.cursorType }}</span>
    </div>
    <div class="card">
      <h3>Buttons</h3>
      <div class="buttons">
        <span
          v-for="btn in mouseState.buttons"
          :key="btn.button"
          :class="{ active: btn.pressed }"
          class="btn-indicator"
        >
          {{ btn.name }}
        </span>
        <span v-if="!mouseState.buttons.length" class="empty">none</span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  platform: { type: String, default: 'unknown' },
  mousePosition: { type: Object, default: () => ({ x: 0, y: 0 }) },
  mouseState: { type: Object, default: () => ({ cursorType: 'default', buttons: [] }) },
});
</script>

<style scoped>
.status-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.card {
  background: var(--surface);
  border-radius: 12px;
  padding: 20px;
  border: 1px solid rgba(255,255,255,0.05);
}
.card h3 {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #888;
  margin-bottom: 8px;
}
.value {
  font-size: 18px;
  font-weight: 600;
  font-family: 'JetBrains Mono', monospace;
}
.buttons { display: flex; gap: 8px; flex-wrap: wrap; }
.btn-indicator {
  padding: 4px 12px;
  border-radius: 6px;
  background: rgba(255,255,255,0.05);
  font-size: 13px;
  transition: all 0.2s;
}
.btn-indicator.active {
  background: var(--highlight);
  color: #fff;
}
.empty { color: #666; font-size: 13px; }
</style>