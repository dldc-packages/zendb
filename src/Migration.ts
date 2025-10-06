import type { TDriver } from "./Driver.ts";
import { createTables, type TAnySchema } from "./Schema.ts";
import type { TTable, TTableTypes } from "./Table.ts";
import { setUserVersion, userVersion } from "./Utils.ts";
import { createInvalidUserVersion } from "./ZendbErreur.ts";

import * as Expr from "./expr/Expr.ts";

export type TUpdateSchema<
  PrevSchema extends TAnySchema,
  NewSchema extends TAnySchema,
> = (
  prev: PrevSchema,
) => NewSchema;

export interface TMigrationExecParams<
  Db,
  PrevSchema extends TAnySchema,
  Schema extends TAnySchema,
> {
  schema: Schema;
  previousSchema: PrevSchema;
  database: Db;
  previousDatabase: Db;
  copyTable: <
    FromName extends keyof PrevSchema["tables"],
    ToName extends keyof Schema["tables"],
  >(
    fromTableName: FromName,
    toTableName: ToName,
    transform: (
      row: TTableTypes<PrevSchema["tables"][FromName]>["output"],
    ) => TTableTypes<Schema["tables"][ToName]>["input"],
  ) => void;
}

export type TMigrationExecFn<
  Db,
  PrevSchema extends TAnySchema,
  Schema extends TAnySchema,
> = (
  params: TMigrationExecParams<Db, PrevSchema, Schema>,
) => void | Db | Promise<void | Db>;

export type TMigrationInitExecFn<Db, Schema extends TAnySchema> = (
  params: Omit<
    TMigrationExecParams<Db, never, Schema>,
    "previousSchema" | "previousDatabase"
  >,
) => void | Db | Promise<void | Db>;

export interface TMigration<
  Db,
  Schema extends TAnySchema,
> {
  /**
   * Final schema after all migration steps. Export this for use in your application.
   */
  readonly schema: Schema;

  /**
   * Adds a new migration step to the migration chain.
   *
   * @param updater - Function that transforms the current schema into the new schema
   * @returns A function that takes the migration execution logic
   *
   * @example
   * ```ts
   * .step((schema) =>
   *   Schema.declare({
   *     ...schema.definition,
   *     users: {
   *       ...schema.tables.users.definition,
   *       archived: Column.boolean()
   *     }
   *   })
   * )(({ copyTable }) => {
   *   copyTable("users", "users", (user) => ({ ...user, archived: false }));
   *   return Promise.resolve();
   * })
   * ```
   */
  step<NewSchema extends TAnySchema>(
    updater: TUpdateSchema<Schema, NewSchema>,
  ): (
    execFn: TMigrationExecFn<Db, Schema, NewSchema>,
  ) => TMigration<Db, NewSchema>;

  /**
   * Applies all pending migrations to the database.
   *
   * This method is idempotent - it only runs migrations that haven't been applied yet.
   * The system uses SQLite's user_version pragma to track which migrations have been applied.
   *
   * @param currentDatabase - The database instance to migrate
   * @returns The migrated database instance
   *
   * @example
   * ```ts
   * const db = new Database("my-app.db");
   * const migratedDb = await migration.apply(db);
   * ```
   */
  apply(currentDatabase: Db): Promise<Db>;
}

/**
 * Initializes a new migration system with an initial schema.
 *
 * This is the starting point for creating a migration chain. The initial schema
 * represents version 1 of your database.
 *
 * @param driver - The database driver to use for executing operations
 * @param initSchema - The initial database schema
 * @param initExec - Optional function to seed initial data
 * @returns A migration object that can be extended with .step()
 *
 * @example
 * ```ts
 * import { Migration, Schema, Column } from "@dldc/zendb";
 * import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";
 *
 * const migration = Migration.init(
 *   DbSqliteDriver,
 *   Schema.declare({
 *     users: {
 *       id: Column.text().primary(),
 *       name: Column.text()
 *     }
 *   }),
 *   ({ database, schema }) => {
 *     // Optional: seed initial data
 *     return Promise.resolve();
 *   }
 * );
 *
 * // Export the final schema
 * export const schema = migration.schema;
 * ```
 */
export function init<Db, Schema extends TAnySchema>(
  driver: TDriver<Db>,
  initSchema: Schema,
  initExec: TMigrationInitExecFn<Db, Schema>,
): TMigration<Db, Schema> {
  return createMigration({
    driver,
    steps: [{
      schema: initSchema,
      exec: initExec as any,
    }],
  });
}

interface TMigrationInternals {
  driver: TDriver<any>;
  steps: Array<{
    schema: TAnySchema;
    exec: TMigrationExecFn<any, TAnySchema, TAnySchema>;
  }>;
}

function createMigration<Db, Schema extends TAnySchema>(
  internals: TMigrationInternals,
): TMigration<Db, Schema> {
  const schema = internals.steps[internals.steps.length - 1].schema;

  return {
    schema: schema as Schema,
    step<NewSchema extends TAnySchema>(
      updater: TUpdateSchema<Schema, NewSchema>,
    ): (
      execFn: TMigrationExecFn<Db, Schema, NewSchema>,
    ) => TMigration<Db, NewSchema> {
      return (execFn) => {
        const newSchema = updater(schema as any);
        return createMigration<Db, NewSchema>({
          ...internals,
          steps: [...internals.steps, {
            schema: newSchema,
            exec: execFn as any,
          }],
        });
      };
    },

    async apply(
      currentDatabase: Db,
    ): Promise<Db> {
      const currentUserVersion = internals.driver.exec(
        currentDatabase,
        userVersion(),
      );
      // If user version is higher than the number of steps, we cannot migrate
      if (currentUserVersion > internals.steps.length) {
        throw createInvalidUserVersion(
          currentUserVersion,
          internals.steps.length,
        );
      }
      if (currentUserVersion === 0) {
        // Init schema
        const initSchema = internals.steps[0].schema;
        internals.driver.execMany(
          currentDatabase,
          createTables(initSchema.tables),
        );
      }

      // Check if no steps to run
      if (currentUserVersion === internals.steps.length) {
        return currentDatabase;
      }
      const stepsToRun = internals.steps.slice(currentUserVersion);
      const previousStep = currentUserVersion === 0
        ? null
        : internals.steps[currentUserVersion - 1];

      let previousUserVersion = currentUserVersion;
      let previousSchema: TAnySchema = previousStep?.schema || (null as any);
      let previousDatabase = currentDatabase;

      // Run each steps
      for (const step of stepsToRun) {
        const { exec, schema } = step;
        // Create new database
        const nextDatabase = await internals.driver.createDatabase();
        // Init schema in database
        internals.driver.execMany(nextDatabase, createTables(schema.tables));
        const resultDb = await exec({
          schema: schema as any,
          previousSchema,
          database: nextDatabase,
          previousDatabase,
          copyTable: (fromName, toName, transform) =>
            copyTable({
              driver: internals.driver,
              fromDb: previousDatabase,
              toDb: nextDatabase,
              fromTable: previousSchema.tables[fromName],
              toTable: schema.tables[toName],
              transform,
            }),
        });
        previousDatabase = resultDb ?? nextDatabase;
        // Save new user version
        previousUserVersion++;
        internals.driver.exec(
          previousDatabase,
          setUserVersion(previousUserVersion),
        );
        previousSchema = schema;
      }

      return previousDatabase;
    },
  };
}

export interface TCopyTableOptions<
  Db,
  FromTable extends TTable<any, any, any>,
  ToTable extends TTable<any, any, any>,
> {
  driver: TDriver<Db>;
  fromDb: Db;
  toDb: Db;
  fromTable: FromTable;
  toTable: ToTable;
  transform: (
    row: TTableTypes<FromTable>["output"],
  ) => TTableTypes<ToTable>["input"];
  pageSize?: number;
}

export function copyTable<
  Db,
  FromTable extends TTable<any, any, any>,
  ToTable extends TTable<any, any, any>,
>(
  {
    driver,
    fromDb,
    toDb,
    fromTable,
    toTable,
    transform,
    pageSize = 100,
  }: TCopyTableOptions<Db, FromTable, ToTable>,
) {
  const count = driver.exec(fromDb, fromTable.query().count());
  if (count === 0) {
    return;
  }
  let done = 0;
  while (done < count) {
    const rows = driver.exec(
      fromDb,
      fromTable.query().limit(Expr.literal(pageSize)).offset(Expr.literal(done))
        .all(),
    );
    if (rows.length === 0) {
      break;
    }
    const transformed = rows.map(transform);
    driver.exec(toDb, toTable.insertMany(transformed));
    done += rows.length;
  }
}
