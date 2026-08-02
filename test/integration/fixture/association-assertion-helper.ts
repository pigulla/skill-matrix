import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import pgPromise from 'pg-promise'
import type { Class } from 'type-fest'
import { expect } from 'vitest'

import { Example } from '#/domain/example/example.js'
import { asExampleID, type ExampleID } from '#/domain/example/example-id.js'
import { Skill } from '#/domain/skill/skill.js'
import { asSkillID, type SkillID } from '#/domain/skill/skill-id.js'
import { Team } from '#/domain/team/team.js'
import { asTeamID, type TeamID } from '#/domain/team/team-id.js'

interface ITeamToSkillAssociationHelper<C extends readonly string[] = []> {
  to(entity: Class<Skill>): Pick<ITeamToSkillAssociationHelper<C>, 'withId' | 'should'>
  withId(
    ids: SkillID | Iterable<SkillID>,
  ): Pick<ITeamToSkillAssociationHelper<C>, 'andColumns' | 'should'>
  andColumns<const T extends readonly 'proficiency'[]>(
    ...columns: T
  ): Pick<ITeamToSkillAssociationHelper<T>, 'withData'>
  withData(
    values: Record<SkillID, Record<C[number], string | number | boolean | null>>,
  ): Pick<ITeamToSkillAssociationHelper<C>, 'should'>
  readonly should: Pick<ITeamToSkillAssociationHelper<C>, 'not' | 'exist' | 'exclusively'>
  readonly not: Pick<ITeamToSkillAssociationHelper<C>, 'exclusively' | 'exist'>
  readonly exclusively: Pick<ITeamToSkillAssociationHelper<C>, 'exist'>
  exist(): Promise<void>
}

interface IExampleToSkillAssociationHelper {
  to(entity: Class<Skill>): Pick<IExampleToSkillAssociationHelper, 'withId' | 'should'>
  withId(ids: SkillID | Iterable<SkillID>): Pick<IExampleToSkillAssociationHelper, 'should'>
  readonly should: Pick<IExampleToSkillAssociationHelper, 'not' | 'exist'>
  readonly not: Pick<IExampleToSkillAssociationHelper, 'exist'>
  exist(): Promise<void>
}

interface ISkillToExampleAssociationHelper {
  to(entity: Class<Example>): Pick<ISkillToExampleAssociationHelper, 'withId' | 'should'>
  withId(ids: ExampleID | Iterable<ExampleID>): Pick<ISkillToExampleAssociationHelper, 'should'>
  readonly should: Pick<ISkillToExampleAssociationHelper, 'not' | 'exist'>
  readonly not: Pick<ISkillToExampleAssociationHelper, 'exist'>
  exist(): Promise<void>
}

export const ASSOCIATION_ASSERTION_HELPER = Symbol('association-assertion-helper')

export type AssociationHelper = {
  from<T extends Class<Example> | Class<Skill> | Class<Team>>(
    entity: T,
  ): {
    withId(id: SkillID): Pick<ISkillToExampleAssociationHelper, 'to'>
    withId(id: ExampleID): Pick<IExampleToSkillAssociationHelper, 'to'>
    withId(id: TeamID): Pick<ITeamToSkillAssociationHelper, 'to'>
  }
}

export function createAssociationAssertionHelper(db: Database): AssociationHelper {
  function teamToSkill(id: TeamID): ITeamToSkillAssociationHelper {
    let negated = false
    let skillIds: Set<SkillID> = new Set()
    let exclusively = false
    const data = {
      columns: new Set<string>(),
      data: null as null | Record<SkillID, Record<string, string | number | boolean | null>>,
    }

    return {
      get should(): ITeamToSkillAssociationHelper['should'] {
        return this
      },
      get not(): ITeamToSkillAssociationHelper['not'] {
        negated = !negated
        return this
      },
      get exclusively(): ITeamToSkillAssociationHelper['exclusively'] {
        exclusively = true
        return this
      },
      to(_entity: Class<Skill>): ReturnType<ITeamToSkillAssociationHelper['to']> {
        return this
      },
      withId(
        ids: SkillID | Iterable<SkillID>,
      ): ReturnType<ITeamToSkillAssociationHelper['withId']> {
        skillIds = new Set((typeof ids === 'string' ? [ids] : [...ids]).map(id => asSkillID(id)))
        return this
      },
      andColumns<const T extends readonly 'proficiency'[]>(
        ...columns: T
      ): ReturnType<ITeamToSkillAssociationHelper<T>['andColumns']> {
        data.columns = new Set(columns)
        return this
      },
      withData(
        values: Record<SkillID, Record<string, string | number | boolean | null>>,
      ): ReturnType<ITeamToSkillAssociationHelper['withData']> {
        expect([...skillIds]).to.have.same.members(Object.keys(values))
        data.data = { ...values }
        return this
      },
      async exist(): ReturnType<ITeamToSkillAssociationHelper['exist']> {
        // TODO: I don't think this really works yet. We definitely need to test this properly
        // before relying on it for the _actual_ test.
        const rows = await db.manyOrNone<
          { skill_id: SkillID } & Record<string, string | number | boolean | null>
        >('SELECT $(columns:name) FROM team_skills WHERE team_id = $(id) AND $(clause:raw)', {
          id,
          columns: ['skill_id', ...data.columns],
          clause: exclusively
            ? 'TRUE'
            : pgPromise.as.format('skill_id IN ($1:list)', [...skillIds]),
        })
        const expected = data.data
        const actual = rows.reduce(
          (map, { skill_id, ...rest }) => Object.assign(map, { [skill_id]: rest }),
          {} as Record<SkillID, Record<string, string | number | boolean | null>>,
        )

        if (negated) {
          expect(expected).not.toEqual(actual)
        } else {
          expect(expected).toEqual(actual)
        }
      },
    }
  }

  function exampleToSkill(id: ExampleID): IExampleToSkillAssociationHelper {
    let negated = false
    let skillIds: Set<SkillID> = new Set()

    return {
      get should(): IExampleToSkillAssociationHelper['should'] {
        return this
      },
      get not(): IExampleToSkillAssociationHelper['not'] {
        negated = !negated
        return this
      },
      to(_entity: Class<Skill>): ReturnType<IExampleToSkillAssociationHelper['to']> {
        return this
      },
      withId(
        ids: SkillID | Iterable<SkillID>,
      ): ReturnType<IExampleToSkillAssociationHelper['withId']> {
        skillIds = new Set((typeof ids === 'string' ? [ids] : [...ids]).map(id => asSkillID(id)))
        return this
      },
      async exist(): ReturnType<IExampleToSkillAssociationHelper['exist']> {
        const rows = await db.manyOrNone<{ id: string }>(
          'SELECT skill_id AS id FROM examples_to_skills WHERE example_id = $(id)',
          { id },
        )
        const actual = new Set(rows.map(({ id }) => id))

        if (negated) {
          expect(skillIds).not.toEqual(actual)
        } else {
          expect(skillIds).toEqual(actual)
        }
      },
    }
  }

  function skillToExample(id: SkillID): ISkillToExampleAssociationHelper {
    let negated = false
    let exampleIds: Set<ExampleID> = new Set()

    return {
      get should(): ISkillToExampleAssociationHelper['should'] {
        return this
      },
      get not(): ISkillToExampleAssociationHelper['not'] {
        negated = !negated
        return this
      },
      to(_entity: Class<Example>): ReturnType<ISkillToExampleAssociationHelper['to']> {
        return this
      },
      withId(
        ids: ExampleID | Iterable<ExampleID>,
      ): ReturnType<ISkillToExampleAssociationHelper['withId']> {
        exampleIds = new Set(
          (typeof ids === 'string' ? [ids] : [...ids]).map(id => asExampleID(id)),
        )
        return this
      },
      async exist(): ReturnType<ISkillToExampleAssociationHelper['exist']> {
        const rows = await db.manyOrNone<{ id: string }>(
          'SELECT example_id AS id FROM examples_to_skills WHERE skill_id = $(id)',
          { id },
        )
        const actual = new Set(rows.map(({ id }) => id))

        if (negated) {
          expect(exampleIds).not.toEqual(actual)
        } else {
          expect(exampleIds).toEqual(actual)
        }
      },
    }
  }

  return {
    from(entity: Class<Skill> | Class<Example> | Class<Team>) {
      return {
        withId(id: SkillID | ExampleID | TeamID) {
          if (entity === Example) {
            return exampleToSkill(asExampleID(id))
          }
          if (entity === Skill) {
            return skillToExample(asSkillID(id))
          }
          return teamToSkill(asTeamID(id))
        },
      }
    },
  }
}
