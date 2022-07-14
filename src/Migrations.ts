import { schemaToCreateTableQueries } from './CreateTableUtils';
import { Database } from './Database';
import { IDriver, IDriverDatabase, IDriverStatement } from './Driver';
import { SchemaAny } from './schema';
import { fingerprintString } from './Utils';

type Options = {
  databasePath: string;
  migrationDatabasePath: string;
};

type Migrate<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  PrevSchema extends SchemaAny | null,
  NextSchema extends SchemaAny
> = (
  prev: PrevSchema extends SchemaAny ? Database<DriverStatement, DriverDatabase, PrevSchema> : null,
  next: Database<DriverStatement, DriverDatabase, NextSchema>
) => void | Promise<void>;

type MigrationItem<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  PrevSchema extends SchemaAny | null,
  NextSchema extends SchemaAny
> = {
  id: string;
  description: string;
  schema: NextSchema;
  migrate?: Migrate<DriverStatement, DriverDatabase, PrevSchema, NextSchema>;
};

type FirstMigrationItem<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  Schema extends SchemaAny
> = MigrationItem<DriverStatement, DriverDatabase, null, Schema>;

type MigrationObj = {
  id: string;
  description: string;
  schema: SchemaAny;
  fingerprint: number;
  migrate?: Migrate<IDriverStatement, IDriverDatabase<IDriverStatement>, SchemaAny | null, SchemaAny>;
  // database: Database<SchemaAny>;
};

export class Migrations<
  DriverStatement extends IDriverStatement,
  DriverDatabase extends IDriverDatabase<DriverStatement>,
  Driver extends IDriver<DriverDatabase>,
  Schema extends SchemaAny
> {
  public readonly driver: Driver;

  static create<
    DriverStatement extends IDriverStatement,
    DriverDatabase extends IDriverDatabase<DriverStatement>,
    Driver extends IDriver<DriverDatabase>,
    Schema extends SchemaAny
  >(
    driver: Driver,
    item: FirstMigrationItem<DriverStatement, DriverDatabase, Schema>
  ): Migrations<DriverStatement, DriverDatabase, Driver, Schema> {
    return new Migrations<DriverStatement, DriverDatabase, Driver, Schema>(driver, []).addMigration(item as any);
  }

  private readonly migrations: Array<MigrationObj>;

  private constructor(driver: Driver, migrations: Array<MigrationObj>) {
    this.driver = driver;
    this.migrations = migrations;
  }

  addMigration<NextSchema extends SchemaAny>({
    id,
    description,
    schema,
    migrate,
  }: MigrationItem<DriverStatement, DriverDatabase, Schema, NextSchema>): Migrations<DriverStatement, DriverDatabase, Driver, NextSchema> {
    const createTableQueries = schemaToCreateTableQueries(schema);
    const fingerprint = fingerprintString(
      // add id to allow same schema in multiple mutations (different hash)
      id + '_' + createTableQueries.join('\n'),
      Math.pow(2, 30)
    );
    const item: MigrationObj = { id, description, schema, fingerprint, migrate: migrate as any };
    return new Migrations(this.driver, [...this.migrations, item]);
  }

  private prepareApply(options: Options) {
    const db = this.driver.connect(options.databasePath);
    // const currentVersion = db.pragma(`user_version`, { simple: true }) as number;
    const currentVersion = db.getUserVersion();
    db.close();
    console.info(`Database current version: ${currentVersion}`);
    const stepIndex = this.migrations.findIndex((mig) => mig.fingerprint === currentVersion);
    if (currentVersion !== 0 && stepIndex === -1) {
      throw new Error(`Cannot find current db version in migration list`);
    }
    const queue = this.migrations.slice(stepIndex + 1);
    if (queue.length === 0) {
      console.info(`Database schema is up to date`);
    } else {
      console.info(`${queue.length} migrations to apply`);
    }
    return { queue };
  }

  private applyMigration(mig: MigrationObj, options: Options): void | Promise<void> {
    this.driver.remove(options.migrationDatabasePath);
    const index = this.migrations.indexOf(mig);
    const prevItem = index === 0 ? null : this.migrations[index - 1];
    const prevDb = prevItem ? new Database(this.driver.connect(options.databasePath), prevItem.schema, prevItem.fingerprint) : null;
    const nextDb = new Database(this.driver.connect(options.migrationDatabasePath), mig.schema, mig.fingerprint);
    console.info(`Running migration ${mig.id} "${mig.description}" (${prevItem ? prevItem.fingerprint : 'INIT'} -> ${mig.fingerprint})`);
    nextDb.initSchema();
    const afterMigrate = () => {
      nextDb.writeFingerprint();
      if (prevDb) {
        prevDb.close();
      }
      nextDb.close();
      this.driver.remove(options.databasePath);
      this.driver.rename(options.migrationDatabasePath, options.databasePath);
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

  private finishApply(options: Options): Database<DriverStatement, DriverDatabase, Schema> {
    const lastMig = this.migrations[this.migrations.length - 1];
    return new Database(this.driver.connect(options.databasePath), lastMig.schema as any, lastMig.fingerprint);
  }

  async apply(options: Options): Promise<Database<DriverStatement, DriverDatabase, Schema>> {
    const { queue } = this.prepareApply(options);
    for await (const mig of queue) {
      const result = this.applyMigration(mig, options);
      if (Promise.resolve(result) === result) {
        await result;
      }
    }
    return this.finishApply(options);
  }

  applySync(options: Options): Database<DriverStatement, DriverDatabase, Schema> {
    const { queue } = this.prepareApply(options);
    for (const mig of queue) {
      const result = this.applyMigration(mig, options);
      if (Promise.resolve(result) === result) {
        throw new Error(`Migration ${mig.id} is async. Convert it to a synchronous function or use apply() instead`);
      }
    }
    return this.finishApply(options);
  }
}
