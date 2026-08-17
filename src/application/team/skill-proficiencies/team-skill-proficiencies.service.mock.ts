import { type Mocked, vi } from 'vitest'

import type { ITeamSkillProficienciesService } from './team-skill-proficiencies.service.interface.js'

export type TeamSkillProficienciesServiceMock = Mocked<ITeamSkillProficienciesService>

export function mockTeamSkillProficienciesService(): TeamSkillProficienciesServiceMock {
  return {
    add: vi.fn(),
    get: vi.fn(),
    remove: vi.fn(),
    update: vi.fn(),
  }
}
