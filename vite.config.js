import { defineConfig } from 'vite'

// Minimal config. `base: './'` keeps asset paths relative so the built
// game also works when served from a sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
})
