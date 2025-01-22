import type { UserConfig } from 'vite'
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin'

export default {
  optimizeDeps: {
    esbuildOptions: {
      plugins: [importMetaUrlPlugin]
    },
    include: [
      "vscode-textmate",
      "vscode-oniguruma"
    ],
  }
} satisfies UserConfig
