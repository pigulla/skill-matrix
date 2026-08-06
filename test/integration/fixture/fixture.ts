import type { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

import { ExampleBuilder } from '../../builder/example.builder.js'
import { ExampleKindBuilder } from '../../builder/example-kind.builder.js'
import { SkillBuilder } from '../../builder/skill.builder.js'
import { TeamBuilder } from '../../builder/team.builder.js'
import { TeamSkillProficienciesBuilder } from '../../builder/team-skill-proficiencies.builder.js'
import { UserBuilder } from '../../builder/user.builder.js'
import { by } from '../../util/sort-by-id.js'

export const teams = {
  platformEngineering: TeamBuilder.create<true>({
    id: '22222222-0002-4000-8000-111111111111',
    name: 'Platform Engineering',
  }),
  testing: TeamBuilder.create<true>({
    id: '22222222-0002-4000-8000-222222222222',
    name: 'Testing',
  }),
  traffic: TeamBuilder.create<true>({
    id: '22222222-0002-4000-8000-333333333333',
    name: 'Traffic',
  }),
  coreServices: TeamBuilder.create<true>({
    id: '22222222-0002-4000-8000-444444444444',
    name: 'Core Services',
  }),
}

export const users = {
  peter: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-111111111111',
    firstName: 'Peter',
    lastName: 'Parker',
    email: 'peter.parker@example.com',
    teamId: teams.platformEngineering.id,
  }),
  priscilla: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-222222222222',
    firstName: 'Priscilla',
    lastName: 'Potts',
    email: 'priscilla.potts@example.com',
    teamId: teams.platformEngineering.id,
  }),
  theodore: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-333333333333',
    firstName: 'Theodore',
    lastName: 'Trentin',
    email: 'theodore.trentin@example.com',
    teamId: teams.traffic.id,
  }),
  tess: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-444444444444',
    firstName: 'Tess',
    lastName: 'Turner',
    email: 'tess.turner@example.com',
    teamId: teams.traffic.id,
  }),
  clemens: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-555555555555',
    firstName: 'Clemens',
    lastName: 'Cook',
    email: 'clemens.cook@example.com',
    teamId: teams.coreServices.id,
  }),
  cherie: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-666666666666',
    firstName: 'Cherie',
    lastName: 'Cooper',
    email: 'cherie.cooper@example.com',
    teamId: teams.coreServices.id,
  }),
  courtney: UserBuilder.create<true>({
    id: '11111111-0001-4000-8000-777777777777',
    firstName: 'Courtney',
    lastName: 'Cox',
    email: 'courtney.cox@example.com',
    teamId: teams.coreServices.id,
  }),
}

export const exampleKinds = {
  concept: ExampleKindBuilder.create<true>({
    id: '55555555-0005-4000-8000-111111111111',
    name: 'concept',
  }),
  methodology: ExampleKindBuilder.create<true>({
    id: '55555555-0005-4000-8000-222222222222',
    name: 'methodology',
  }),
  pattern: ExampleKindBuilder.create<true>({
    id: '55555555-0005-4000-8000-333333333333',
    name: 'pattern',
  }),
  technology: ExampleKindBuilder.create<true>({
    id: '55555555-0005-4000-8000-444444444444',
    name: 'technology',
  }),
}

export const examples = {
  html: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-111111111111',
    name: 'HTML',
    exampleKindId: exampleKinds.technology.id,
    url: null,
  }),
  css: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-222222222222',
    name: 'CSS',
    exampleKindId: exampleKinds.technology.id,
    url: null,
  }),
  react: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-333333333333',
    name: 'React',
    exampleKindId: exampleKinds.technology.id,
    url: 'https://react.dev',
  }),
  nestjs: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-444444444444',
    name: 'Nest.js',
    exampleKindId: exampleKinds.technology.id,
    url: 'https://nestjs.com',
  }),
  vuejs: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-555555555555',
    name: 'Vue.js',
    exampleKindId: exampleKinds.technology.id,
    url: 'https://vuejs.org',
  }),
  postgresql: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-666666666666',
    name: 'PostgreSQL',
    exampleKindId: exampleKinds.technology.id,
    url: 'https://www.postgresql.org',
  }),
  solid: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-777777777777',
    name: 'SOLID',
    exampleKindId: exampleKinds.pattern.id,
    url: null,
  }),
  hexagonalArchitecture: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-888888888888',
    name: 'Hexagonal Architecture',
    exampleKindId: exampleKinds.pattern.id,
    url: 'https://en.wikipedia.org/wiki/Hexagonal_architecture_(software)',
  }),
  cobol: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-999999999999',
    name: 'COBOL',
    exampleKindId: exampleKinds.technology.id,
    url: null,
  }),
  infrastructureAsCode: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-aaaaaaaaaaaa',
    name: 'Infrastructure-as-Code',
    exampleKindId: exampleKinds.methodology.id,
    url: null,
  }),
  domainDrivenDesign: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-bbbbbbbbbbbb',
    name: 'Domain-Driven Design',
    exampleKindId: exampleKinds.methodology.id,
    url: 'https://en.wikipedia.org/wiki/Domain-driven_design',
  }),
  circuitBreaker: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-cccccccccccc',
    name: 'Circuit Breaker',
    exampleKindId: exampleKinds.pattern.id,
    url: null,
  }),
  bulkhead: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-dddddddddddd',
    name: 'Bulkhead',
    exampleKindId: exampleKinds.pattern.id,
    url: null,
  }),
  sql: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-eeeeeeeeeeee',
    name: 'SQL',
    exampleKindId: exampleKinds.technology.id,
    url: null,
  }),
  factory: ExampleBuilder.create<true>({
    id: '44444444-0004-4000-8000-ffffffffffff',
    name: 'Factory',
    exampleKindId: exampleKinds.pattern.id,
    url: null,
  }),
}

export const skills = {
  frontendDevelopment: SkillBuilder.create<true>({
    id: '33333333-0003-4000-8000-111111111111',
    name: 'Frontend Development',
    description: 'Building and styling user-facing interfaces for the web.',
    exampleIds: [
      examples.html.id,
      examples.css.id,
      examples.react.id,
      examples.vuejs.id,
      examples.factory.id,
    ],
  }),
  backendDevelopment: SkillBuilder.create<true>({
    id: '33333333-0003-4000-8000-222222222222',
    name: 'Backend Development',
    description: 'Designing and building server-side services, APIs, and data persistence.',
    exampleIds: [
      examples.nestjs.id,
      examples.postgresql.id,
      examples.infrastructureAsCode.id,
      examples.circuitBreaker.id,
      examples.bulkhead.id,
      examples.sql.id,
      examples.factory.id,
    ],
  }),
  softwareArchitecture: SkillBuilder.create<true>({
    id: '33333333-0003-4000-8000-333333333333',
    name: 'Software Architecture',
    description:
      'The high-level structure of a software system, including its components, relationships, and the key decisions guiding its design and evolution.',
    exampleIds: [
      examples.solid.id,
      examples.hexagonalArchitecture.id,
      examples.domainDrivenDesign.id,
    ],
  }),
  qualityAssurance: SkillBuilder.create<true>({
    id: '33333333-0003-4000-8000-444444444444',
    name: 'Quality Assurance',
    description:
      'Verifying software correctness and reliability through testing and process improvement.',
    exampleIds: [],
  }),
}

const bySkillId = by('skillId')

export const teamSkillProficiencies = {
  platformEngineering: TeamSkillProficienciesBuilder.create<true>({
    teamId: teams.platformEngineering.id,
    skills: [{ skillId: skills.backendDevelopment.id, proficiency: 1 }].sort(bySkillId),
  }),
  testing: TeamSkillProficienciesBuilder.create<true>({
    teamId: teams.testing.id,
    skills: [].sort(bySkillId),
  }),
  traffic: TeamSkillProficienciesBuilder.create<true>({
    teamId: teams.traffic.id,
    skills: [
      { skillId: skills.backendDevelopment.id, proficiency: 2 },
      { skillId: skills.frontendDevelopment.id, proficiency: 3 },
      { skillId: skills.softwareArchitecture.id, proficiency: 2 },
    ].sort(bySkillId),
  }),
  coreServices: TeamSkillProficienciesBuilder.create<true>({
    teamId: teams.coreServices.id,
    skills: [
      { skillId: skills.backendDevelopment.id, proficiency: 3 },
      { skillId: skills.softwareArchitecture.id, proficiency: 3 },
    ].sort(bySkillId),
  }),
} satisfies Record<keyof typeof teams, TeamSkillProficiencies>
