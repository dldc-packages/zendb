import { Database } from './Database';
import { SchemaAny } from './schema';
import DB from 'better-sqlite3';
import fs from 'fs';

type Options = {
  databasePath: string;
  migrationDatabasePath: string;
};

type Migrate<PrevSchema extends SchemaAny | null, NextSchema extends SchemaAny> = (
  prev: PrevSchema extends SchemaAny ? Database<PrevSchema> : null,
  next: Database<NextSchema>
) => void | Promise<void>;

type MigrationItem<PrevSchema extends SchemaAny | null, NextSchema extends SchemaAny> = {
  id: string;
  description: string;
  schema: NextSchema;
  migrate?: Migrate<PrevSchema, NextSchema>;
};

type FirstMigrationItem<Schema extends SchemaAny> = MigrationItem<null, Schema>;

type MigrationObj = {
  id: string;
  description: string;
  database: Database<SchemaAny>;
  migrate?: Migrate<SchemaAny | null, SchemaAny>;
};

export class Migrations<Schema extends SchemaAny> {
  static create<Schema extends SchemaAny>(item: FirstMigrationItem<Schema>): Migrations<Schema> {
    return new Migrations([]).addMigration(item as any);
  }

  private readonly migrations: Array<MigrationObj>;

  private constructor(migrations: Array<MigrationObj>) {
    this.migrations = migrations;
  }

  addMigration<NextSchema extends SchemaAny>({
    id,
    description,
    schema,
    migrate,
  }: MigrationItem<Schema, NextSchema>): Migrations<NextSchema> {
    const database = new Database(schema, this.migrations.length);
    const item: MigrationObj = {
      id,
      description,
      database: database as any,
      migrate: migrate as any,
    };
    return new Migrations([...this.migrations, item]);
  }

  private prepareApply(options: Options) {
    const db = new DB(options.databasePath);
    const currentVersion = db.pragma(`user_version`, { simple: true }) as number;
    db.close();
    console.info(`Database current version: ${currentVersion}`);
    const stepIndex = this.migrations.findIndex(
      (mig) => mig.database.fingerpring === currentVersion
    );
    if (currentVersion !== 0 && stepIndex === -1) {
      throw new Error(`Cannot find current db version in migration list`);
    }
    const queue = this.migrations.slice(stepIndex + 1);
    if (queue.length === 0) {
      console.log(`Database schema is up to date`);
    } else {
      console.log(`${queue.length} migrations to apply`);
    }
    return { queue };
  }

  private applyMigration(mig: MigrationObj, options: Options): void | Promise<void> {
    const index = this.migrations.indexOf(mig);
    const prevItem = index === 0 ? null : this.migrations[index - 1];
    const prevDb = prevItem ? prevItem.database : null;
    const nextDb = mig.database;
    console.log(
      `Running migration ${mig.id} "${mig.description}" (${
        prevDb ? prevDb.fingerpring : 'INIT'
      } -> ${nextDb.fingerpring})`
    );
    if (prevDb) {
      prevDb.connect(options.databasePath);
    }
    removeSyncIfExist(options.migrationDatabasePath);
    nextDb.connect(options.migrationDatabasePath);
    nextDb.initSchema();
    const afterMigrate = () => {
      nextDb.setUserVersion();
      if (prevDb) {
        prevDb.close();
      }
      nextDb.close();
      removeSyncIfExist(options.databasePath);
      fs.renameSync(options.migrationDatabasePath, options.databasePath);
    };
    if (!mig.migrate) {
      return afterMigrate();
    }
    if (mig.migrate) {
      const result = mig.migrate(prevDb, nextDb);
      if (Promise.resolve(result) === result) {
        // async
        return result.then(() => afterMigrate());
      }
      // sync
      return afterMigrate();
    }
  }

  private finishApply(options: Options): Database<Schema> {
    const lastDb = this.migrations[this.migrations.length - 1].database;
    lastDb.connect(options.databasePath);
    return lastDb as any;
  }

  async apply(options: Options): Promise<Database<Schema>> {
    const { queue } = this.prepareApply(options);
    for await (const mig of queue) {
      const result = this.applyMigration(mig, options);
      if (Promise.resolve(result) === result) {
        await result;
      }
    }
    return this.finishApply(options);
  }

  applySync(options: Options): Database<Schema> {
    const { queue } = this.prepareApply(options);
    for (const mig of queue) {
      const result = this.applyMigration(mig, options);
      if (Promise.resolve(result) === result) {
        throw new Error(
          `Migration ${mig.id} is async. Convert it to a synchronous function or use apply() instead`
        );
      }
    }
    return this.finishApply(options);
  }
}

function removeSyncIfExist(path: string) {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    return;
  }
}
