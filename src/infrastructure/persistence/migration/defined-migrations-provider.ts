import { Inject, Injectable } from '@nestjs/common'
import { glob } from 'glob'

import { IDefinedMigrationsProvider } from './defined-migrations-provider.interface.js'
import { asMigration, type Migration } from './migration.js'

export const MIGRATIONS_DIRECTORY = Symbol('migrations-directory')

@Injectable()
export class DefinedMigrationsProvider implements IDefinedMigrationsProvider {
  private readonly migrationsDirectory: string

  public constructor(@Inject(MIGRATIONS_DIRECTORY) migrationsDirectory: string) {
    this.migrationsDirectory = migrationsDirectory
  }

  public async getAll(): Promise<Migration[]> {
    const files = await glob('*.sql', {
      cwd: this.migrationsDirectory,
      nodir: true,
    })
    return files
      .map(file => file.substring(0, file.length - '.sql'.length))
      .map(value => asMigration(value))
      .sort()
  }
}
