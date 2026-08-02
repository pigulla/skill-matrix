import type { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

import { ExampleBuilder } from '../../builder/example.builder.js'
import { SkillBuilder } from '../../builder/skill.builder.js'
import { TeamBuilder } from '../../builder/team.builder.js'
import { TeamSkillProficienciesBuilder } from '../../builder/team-skill-proficiencies.builder.js'
import { UserBuilder } from '../../builder/user.builder.js'

export const teams = {
  platform: TeamBuilder.create({
    id: '40000000-0002-4000-8000-000000000001',
    name: 'Platform',
  }),
  product: TeamBuilder.create({
    id: '40000000-0002-4000-8000-000000000002',
    name: 'Product',
  }),
  qa: TeamBuilder.create({
    id: '40000000-0002-4000-8000-000000000003',
    name: 'QA',
  }),
}

export const users = {
  eddie: UserBuilder.create({
    id: '10000000-0001-4000-8000-edd1ebea1e00',
    firstName: 'Eddie',
    lastName: 'Beale',
    email: 'eddie.beale@example.com',
    teamId: teams.platform.id,
  }),
  tess: UserBuilder.create({
    id: '20000000-0001-4000-8000-7e555ad1e900',
    firstName: 'Tess',
    lastName: 'Sadler',
    email: 'tess.sadler@example.com',
    teamId: teams.platform.id,
  }),
  dale: UserBuilder.create({
    id: '30000000-0001-4000-8000-da1e61a55000',
    firstName: 'Dale',
    lastName: 'Glass',
    email: 'dale.glass@example.com',
    teamId: teams.product.id,
  }),
}

export const exampleKinds = {
  CONCEPT: 'concept',
  METHODOLOGY: 'methodology',
  PATTERN: 'pattern',
  TECHNOLOGY: 'technology',
}

export const examples = {
  react: ExampleBuilder.create({
    id: 'a0000000-0004-4000-8000-000000000003',
    name: 'React',
    kind: exampleKinds.TECHNOLOGY,
    url: 'https://react.dev',
  }),
  nestjs: ExampleBuilder.create({
    id: 'a0000000-0004-4000-8000-000000000001',
    name: 'NestJS',
    kind: exampleKinds.TECHNOLOGY,
    url: 'https://nestjs.com',
  }),
  postgresql: ExampleBuilder.create({
    id: 'a0000000-0004-4000-8000-000000000002',
    name: 'PostgreSQL',
    kind: exampleKinds.TECHNOLOGY,
    url: 'https://www.postgresql.org',
  }),
  solid: ExampleBuilder.create({
    id: 'a0000000-0004-4000-8000-000000000004',
    name: 'SOLID',
    kind: exampleKinds.METHODOLOGY,
    url: null,
  }),
  nextjs: ExampleBuilder.create({
    id: 'a0000000-0004-4000-8000-000000000005',
    name: 'Next.js',
    kind: exampleKinds.TECHNOLOGY,
    url: 'https://nextjs.org',
  }),
  cobol: ExampleBuilder.create({
    id: 'a0000000-0004-4000-8000-000000000006',
    name: 'COBOL',
    kind: exampleKinds.TECHNOLOGY,
    url: null,
  }),
}

export const skills = {
  backendDevelopment: SkillBuilder.create({
    id: '10000000-0003-4000-8000-5c111a00a100',
    name: 'Backend Development',
    description: 'Designing and building server-side services.',
    exampleIds: [examples.nestjs.id, examples.postgresql.id],
  }),
  frontendDevelopment: SkillBuilder.create({
    id: '20000000-0003-4000-8000-5c111b00b200',
    name: 'Frontend Development',
    description: 'Building modern web user interfaces.',
    exampleIds: [examples.react.id, examples.nextjs.id],
  }),
  softwareArchitecture: SkillBuilder.create({
    id: '30000000-0003-4000-8000-5c111c00c300',
    name: 'Software Architecture',
    description:
      'The high-level structure of a software system, including its components, relationships, and the key decisions guiding its design and evolution.',
    exampleIds: [examples.solid.id],
  }),
}

export const teamSkillProficiencies = {
  platform: TeamSkillProficienciesBuilder.create({
    teamId: teams.platform.id,
    skills: [
      { skillId: skills.backendDevelopment.id, proficiency: 3 },
      { skillId: skills.softwareArchitecture.id, proficiency: 2 },
    ],
  }),
  product: TeamSkillProficienciesBuilder.create({
    teamId: teams.product.id,
    skills: [
      { skillId: skills.softwareArchitecture.id, proficiency: 2 },
      { skillId: skills.backendDevelopment.id, proficiency: 1 },
    ],
  }),
  qa: TeamSkillProficienciesBuilder.create({
    teamId: teams.qa.id,
    skills: [],
  }),
} satisfies Record<keyof typeof teams, TeamSkillProficiencies>
