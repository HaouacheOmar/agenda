<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: number
  total: number
  color: string
}>()

// Share of all visible events, drawn as a progress ring.
const RADIUS = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const dashOffset = computed(() => CIRCUMFERENCE * (1 - (props.total ? props.value / props.total : 0)))
</script>

<template>
  <div class="meter">
    <div class="meter-text">
      <span class="meter-label">{{ label }}</span>
      <span class="meter-value">{{ value }}</span>
    </div>
    <svg class="meter-ring" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" :r="RADIUS" class="meter-track" />
      <circle
        cx="28"
        cy="28"
        :r="RADIUS"
        class="meter-arc"
        stroke="currentColor"
        :style="{ color }"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="dashOffset"
      />
    </svg>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 100%;
}

.meter-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meter-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-muted-fg);
}

.meter-value {
  font-family: var(--font-heading);
  font-size: 40px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.meter-ring {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  transform: rotate(-90deg);
}

.meter-track,
.meter-arc {
  fill: none;
  stroke-width: 5;
}

.meter-track {
  stroke: rgba(255, 255, 255, 0.08);
}

.meter-arc {
  stroke-linecap: round;
  transition: stroke-dashoffset 600ms var(--ease-out);
  filter: drop-shadow(0 0 6px currentColor);
}
</style>
