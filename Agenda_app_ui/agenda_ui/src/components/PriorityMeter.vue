<script setup lang="ts">
interface Props {
  label: string
  value: number
  total: number
  color: string
}

const props = defineProps<Props>()
</script>

<template>
  <div class="meter-container">
    <h3>{{ label }}</h3>
    <div class="meter-wrapper">
      <svg class="meter-svg" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="none"
          stroke="#d6dde7"
          stroke-width="3"
        />
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="none"
          :stroke="color"
          stroke-width="3"
        />
      </svg>
      <div class="meter-content">
        <span class="meter-value" :style="{ color: props.color }">{{ value }}</span>
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
  font-size: 30px;
  color: #111827;
  font-weight: 600;
  text-align: center;
}

.meter-wrapper {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

.meter-svg {
  width: 84px;
  height: 84px;
}

.meter-content {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.meter-value {
  font-size: 42px;
  font-weight: 500;
  line-height: 1;
}

@media (max-width: 640px) {
  .meter-container h3 {
    font-size: 22px;
  }

  .meter-svg {
    width: 72px;
    height: 72px;
  }

  .meter-value {
    font-size: 36px;
  }
}
</style>