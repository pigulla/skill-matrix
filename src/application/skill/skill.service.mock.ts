import { type Mocked, vi } from 'vitest'

import type { ISkillService } from './skill.service.interface.js'

export type SkillServiceMock = Mocked<ISkillService>

export function mockSkillService(): SkillServiceMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
