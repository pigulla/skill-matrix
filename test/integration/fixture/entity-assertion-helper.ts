import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import type { Class } from 'type-fest'
import { expect } from 'vitest'

import { Example } from '#/domain/example/example.js'
import { asExampleID } from '#/domain/example/example-id.js'
import { Skill } from '#/domain/skill/skill.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { Team } from '#/domain/team/team.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { User } from '#/domain/user/user.js'
import { asUserID } from '#/domain/user/user-id.js'

type Entity = Class<User> | Class<Team> | Class<Skill> | Class<Example>

const TABLES = {
  [User.name]: 'users',
  [Team.name]: 'teams',
  [Skill.name]: 'skills',
  [Example.name]: 'examples',
} satisfies Record<string, string>

const ID_MAPPERS = {
  [User.name]: asUserID,
  [Team.name]: asTeamID,
  [Skill.name]: asSkillID,
  [Example.name]: asExampleID,
} satisfies Record<string, (value: string) => string>

type Properties = Record<string, string | number | boolean | null>

export interface IEntityAssertionHelper {
  andColumns(properties: Properties): Pick<IEntityAssertionHelper, 'should'>
  readonly should: Pick<IEntityAssertionHelper, 'not' | 'exist'>
  readonly not: Pick<IEntityAssertionHelper, 'exist'>
  exist(): Promise<void>
}

export type EntityAssertionHelper = <T extends Entity>(
  clazz: T,
) => { withId(id: string): IEntityAssertionHelper }

export const ENTITY_ASSERTION_HELPER = Symbol('entity-assertion-helper')

export function createEntityAssertionHelper(db: Database): EntityAssertionHelper {
  return <T extends Entity>(clazz: T) => ({
    withId(value: string): IEntityAssertionHelper {
      const id = ID_MAPPERS[clazz.name](value) as InstanceType<T>['id']
      let properties: Record<string, string | number | boolean> & { id: string } = { id }
      let negated = false

      return {
        andColumns(props: Properties): ReturnType<IEntityAssertionHelper['andColumns']> {
          if ('id' in props) {
            // Unfortunately this is pretty cumbersome to do in TypeScript alone, see:
            // https://stackoverflow.com/questions/51442157/#answer-63549561
            throw new Error('id property can not be overridden')
          }
          properties = { ...props, id }
          return this
        },
        get should(): IEntityAssertionHelper['should'] {
          return this
        },
        get not(): IEntityAssertionHelper['not'] {
          negated = !negated
          return this
        },
        async exist(): ReturnType<IEntityAssertionHelper['exist']> {
          const row = await db.oneOrNone(
            'SELECT $(columns:name) FROM $(table:name) WHERE id=$(id)',
            {
              columns: Object.keys(properties),
              table: TABLES[clazz.name],
              id,
            },
          )

          if (negated) {
            if (row) {
              expect(row).not.toEqual(properties)
            }
          } else {
            expect(row).toEqual(properties)
          }
        },
      } satisfies IEntityAssertionHelper
    },
  })
}
