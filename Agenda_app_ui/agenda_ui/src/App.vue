<script setup lang="ts">
import { MotionConfig } from 'motion-v'
import './styles/base.css'
</script>

<template>
  <!-- reducedMotion="user": honour the OS "reduce motion" setting for every animation -->
  <MotionConfig reduced-motion="user">
    <router-view />
  </MotionConfig>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}
</style>
