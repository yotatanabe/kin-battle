import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // ↓ この1行を追加します（GitHubのリポジトリ名と同じにします）
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
})