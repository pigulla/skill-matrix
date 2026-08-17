import { type Mocked, vi } from 'vitest'

import type { ISkillRepository } from './skill.repository.interface.js'

export type SkillRepositoryMock = Mocked<ISkillRepository>

export function mockSkillRepository(): SkillRepositoryMock {
  return {
    getAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
