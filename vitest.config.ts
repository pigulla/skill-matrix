import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // @swc/core does not yet accept the `es2025` jsc target inherited from
  // @tsconfig/node26, so pin the test-transform target explicitly. This is
  // transform-only and does not affect the project's tsconfig or build.
  plugins: [swc.vite({ jsc: { target: 'esnext' }, module: { type: 'es6' } })],
  oxc: false,
  test: {
    environment: 'node',
    include: ['src/**/*\\.test\\.ts', 'test/**/*.test.ts'],
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        '**/*.config.ts',
        '**/*.dto.ts',
        '**/*.error.ts',
        '**/*.interface.ts',
        '**/*.mock.ts',
        '**/*.module.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        perFile: true,
        'src/application/**/*.ts': { branches: 100 },
        'src/presentation/**/*.ts': { branches: 100 },
      },
    },
  },
})
