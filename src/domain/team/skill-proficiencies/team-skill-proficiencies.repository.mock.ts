import { type Mocked, vi } from 'vitest'

import type { ITeamSkillProficienciesRepository } from './team-skill-proficiencies.repository.interface.js'

export type TeamSkillProficienciesRepositoryMock = Mocked<ITeamSkillProficienciesRepository>

export function mockTeamSkillProficienciesRepository(): TeamSkillProficienciesRepositoryMock {
  return {
    get: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  }
}
