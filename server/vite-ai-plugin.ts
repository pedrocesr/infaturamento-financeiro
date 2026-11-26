import { loadEnv, type Plugin } from 'vite'
import { createAiMiddleware } from './ai.mjs'

export function financialAi(): Plugin {
  let root = process.cwd()
  let mode = 'development'
  const middleware = () => {
    const env = loadEnv(mode, root, '')
    return createAiMiddleware({ apiKey: process.env.GEMINI_API_KEY || env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-3.5-flash-lite' })
  }
  return {
    name: 'infaturamento-server-ai',
    configResolved(config) { root = config.root; mode = config.mode },
    configureServer(server) { server.middlewares.use(middleware()) },
    configurePreviewServer(server) { server.middlewares.use(middleware()) },
  }
}
