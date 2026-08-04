import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

import { handleCommentsRequest } from './server/comments.js'

const communityApi = () => ({
  name: 'community-api',
  configureServer(server) {
    server.middlewares.use('/api/comments', (request, response) =>
      handleCommentsRequest(request, response),
    )
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [vue(), vueDevTools(), communityApi()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
