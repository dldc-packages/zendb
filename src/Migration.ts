import type { TDriver } from "./Driver.ts";
import { createTables, type TAnySchema } from "./Schema.ts";
import type { TTable, TTableTypes } from "./Table.ts";
import { setUserVersion, userVersion } from "./Utils.ts";
import { createInvalidUserVersion } from "./ZendbErreur.ts";

import * as Expr from "./expr/Expr.ts";

/**
 * Function that transforms a schema from one version to the next.
 */
export type TUpdateSchema<
  PrevSchema extends TAnySchema,
  NewSchema extends TAnySchema,
> = (
  prev: PrevSchema,
) => NewSchema;

/**
 * Parameters passed to migration execution functions.
 */
export interface TMigrationExecParams<
  Db,
  PrevSchema extends TAnySchema,
  Schema extends TAnySchema,
> {
  /** The new schema after this migration step */
  schema: Schema;
  /** The schema from the previous migration step */
  previousSchema: PrevSchema;
  /** The new database instance for this migration step */
  database: Db;
  /** The database instance from the previous migration step */
  previousDatabase: Db;
  /**
   * Helper function to copy data from a table in the previous schema
   * to a table in the new schema, with optional transformation.
   */
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

/**
 * Function that executes a migration step, copying and transforming data.
 * Can optionally return a database instance to use instead of the one created.
 */
export type TMigrationExecFn<
  Db,
  PrevSchema extends TAnySchema,
  Schema extends TAnySchema,
> = (
  params: TMigrationExecParams<Db, PrevSchema, Schema>,
) => void | Db | Promise<void | Db>;

/**
 * Function that executes the initial migration step (seeding initial data).
 * Similar to TMigrationExecFn but without previous schema/database since this is the first step.
 */
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
   * **Resource Management:**
   * - Automatically closes intermediate databases created during migration steps
   * - Closes the input database if migrations start from version 0 and create a new database
   * - Never closes the returned database - the caller is responsible for closing it
   * - If no migrations are needed (already up-to-date), returns the input database unclosed
   *
   * @param currentDatabase - The database instance to migrate. May be closed by this method if migrations are applied from version 0.
   * @returns A tuple containing:
   *   - The migrated database instance (caller must close this)
   *   - A boolean indicating whether the database needs to be persisted (true if migrations were applied, false if already up-to-date)
   *
   * @example
   * ```ts
   * const db = new Database(":memory:");
   * const [migratedDb, needsPersist] = await migration.apply(db);
   * // db may be closed at this point if migrations were applied
   *
   * if (needsPersist) {
   *   // Save the migrated database to disk
   *   const diskDb = new Database("my-app.db");
   *   migratedDb.backup(diskDb, "main", -1);
   *   diskDb.close();
   * }
   *
   * migratedDb.close(); // Always close the returned database when done
   * ```
   */
  apply(currentDatabase: Db): Promise<[database: Db, needsPersist: boolean]>;
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
    ): Promise<[database: Db, needsPersist: boolean]> {
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

      // Check if no steps to run
      if (currentUserVersion === internals.steps.length) {
        return [currentDatabase, false];
      }
      const stepsToRun = internals.steps.slice(currentUserVersion);
      const previousStep = currentUserVersion === 0
        ? null
        : internals.steps[currentUserVersion - 1];

      let previousUserVersion = currentUserVersion;
      let previousSchema: TAnySchema = previousStep?.schema || (null as any);
      let previousDatabase = currentDatabase;
      const databasesToClose: Db[] = [];
      // Track if currentDatabase needs to be closed (when migrations start from version 0)
      const shouldCloseInitialDatabase = currentUserVersion === 0;

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
        const newDatabase = resultDb ?? nextDatabase;

        // Close the previous database if it's not the original input database
        // and it's not the new database we just created
        if (
          previousDatabase !== currentDatabase &&
          previousDatabase !== newDatabase
        ) {
          databasesToClose.push(previousDatabase);
        }

        // If a different database was returned from exec, close the nextDatabase
        if (resultDb && resultDb !== nextDatabase) {
          databasesToClose.push(nextDatabase);
        }

        previousDatabase = newDatabase;
        // Save new user version
        previousUserVersion++;
        internals.driver.exec(
          previousDatabase,
          setUserVersion(previousUserVersion),
        );
        previousSchema = schema;
      }

      // Close the initial database if migrations started from version 0
      if (shouldCloseInitialDatabase && currentDatabase !== previousDatabase) {
        await internals.driver.closeDatabase(currentDatabase);
      }

      // Close all intermediate databases
      await Promise.all(
        databasesToClose.map((db) => internals.driver.closeDatabase(db)),
      );

      return [previousDatabase, true];
    },
  };
}

/**
 * Options for copying data from one table to another during migrations.
 */
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

/**
 * Copies data from one table to another with optional transformation.
 *
 * This is a low-level utility used internally by migrations. You typically won't
 * call this directly - instead use the `copyTable` function provided in migration
 * step callbacks.
 *
 * **Features:**
 * - Automatically handles pagination for large tables
 * - Supports data transformation during copy
 * - Type-safe source and destination tables
 *
 * @param options - Configuration for the table copy operation
 *
 * @example
 * ```ts
 * // This is typically used within a migration step:
 * .step((schema) => newSchema)(({ copyTable }) => {
 *   copyTable("users", "users", (user) => ({
 *     ...user,
 *     newColumn: "default value"
 *   }));
 * });
 * ```
 */
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
