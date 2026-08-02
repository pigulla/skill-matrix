import { type Mocked, vi } from 'vitest'

import type { ISkillRepository } from './skill.repository.interface.js'

export type SkillRepositoryMock = Mocked<ISkillRepository>

export function mockSkillRepository(): SkillRepositoryMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
