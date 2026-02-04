<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: number
  total: number
  color: string
}

const props = defineProps<Props>()

const percentage = computed(() => {
  return props.total === 0 ? 0 : Math.round((props.value / props.total) * 100)
})

const circumference = computed(() => 2 * Math.PI * 45)
const strokeDashoffset = computed(() => {
  return circumference.value - (percentage.value / 100) * circumference.value
})
</script>

<template>
  <div class="meter-container">
    <h3>{{ label }}</h3>
    <div class="meter-wrapper">
      <svg class="meter-svg" viewBox="0 0 120 120">
        <circle 
          cx="60" 
          cy="60" 
          r="45" 
          fill="none" 
          stroke="#e5e7eb" 
          stroke-width="3"
        />
        <circle 
          cx="60" 
          cy="60" 
          r="45" 
          fill="none" 
          :stroke="color" 
          stroke-width="3"
          stroke-dasharray="282.7"
          :stroke-dashoffset="strokeDashoffset"
          stroke-linecap="round"
          class="progress-circle"
        />
        <!-- Starting point indicator -->
        <circle 
          cx="60" 
          cy="15" 
          r="4" 
          :fill="color"
          class="start-point"
        />
      </svg>
      <div class="meter-content">
        <span class="meter-value">{{ value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.meter-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.meter-container h3 {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-align: center;
}

.meter-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.meter-svg {
  width: 120px;
  height: 120px;
  transform: rotate(-90deg);
}

.progress-circle {
  transition: stroke-dashoffset 0.5s ease;
}

.start-point {
  transition: fill 0.3s ease;
}

.meter-content {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.meter-value {
  font-size: 32px;
  font-weight: bold;
  color: #1f2937;
}

@media (max-width: 640px) {
  .meter-svg {
    width: 100px;
    height: 100px;
  }

  .meter-value {
    font-size: 28px;
  }

  .meter-container h3 {
    font-size: 12px;
  }
}
</style>