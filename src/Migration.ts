import {
  schema as schemaOps,
  setUserVersion,
  type TZenDatabaseBase,
  userVersion,
} from "./Database.ts";
import type { TAnySchema } from "./Schema.ts";
import type { TTable, TTableTypes } from "./Table.ts";
import { createInvalidUserVersion } from "./ZendbErreur.ts";

import * as Expr from "./expr/Expr.ts";

export type TUpdateSchema<
  PrevSchema extends TAnySchema,
  NewSchema extends TAnySchema,
> = (
  prev: PrevSchema,
) => NewSchema;

export interface TApplyParams {
  currentDatabase: TZenDatabaseBase;
  createTempDatabase: () => Promise<TZenDatabaseBase>;
  saveDatabase: (db: TZenDatabaseBase) => Promise<TZenDatabaseBase>;
}

export interface TMigrationExecParams<
  PrevSchema extends TAnySchema,
  Schema extends TAnySchema,
> {
  schema: Schema;
  previousSchema: PrevSchema;
  database: TZenDatabaseBase;
  previousDatabase: TZenDatabaseBase;
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
  PrevSchema extends TAnySchema,
  Schema extends TAnySchema,
> = (
  params: TMigrationExecParams<PrevSchema, Schema>,
) => Promise<void | TZenDatabaseBase>;

export type TMigrationInitExecFn<Schema extends TAnySchema> = (
  params: Omit<
    TMigrationExecParams<never, Schema>,
    "previousSchema" | "previousDatabase"
  >,
) => Promise<void | TZenDatabaseBase>;

export interface TMigration<
  Schema extends TAnySchema,
> {
  /**
   * Final schema, can be exported
   */
  readonly schema: Schema;

  /**
   * Update the schema
   * @param updater A function that takes the current schema and returns the new schema
   */
  step<NewSchema extends TAnySchema>(
    updater: TUpdateSchema<Schema, NewSchema>,
  ): (execFn: TMigrationExecFn<Schema, NewSchema>) => TMigration<NewSchema>;

  /**
   * Apply all migrations and return the updated database
   * @param params
   */
  apply(params: TApplyParams): Promise<TZenDatabaseBase>;
}

export function initMigration<Schema extends TAnySchema>(
  initSchema: Schema,
  initExec: TMigrationInitExecFn<Schema>,
): TMigration<Schema> {
  return createMigration({
    steps: [{
      schema: initSchema,
      exec: initExec as any,
    }],
  });
}

interface TMigrationInternals {
  steps: Array<{
    schema: TAnySchema;
    exec: TMigrationExecFn<TAnySchema, TAnySchema>;
  }>;
}

function createMigration<Schema extends TAnySchema>(
  internals: TMigrationInternals,
): TMigration<Schema> {
  const schema = internals.steps[internals.steps.length - 1].schema;

  return {
    schema: schema as Schema,
    step<NewSchema extends TAnySchema>(
      updater: TUpdateSchema<Schema, NewSchema>,
    ): (execFn: TMigrationExecFn<Schema, NewSchema>) => TMigration<NewSchema> {
      return (execFn) => {
        const newSchema = updater(schema as any);
        return createMigration<NewSchema>({
          ...internals,
          steps: [...internals.steps, {
            schema: newSchema,
            exec: execFn as any,
          }],
        });
      };
    },

    async apply(
      { currentDatabase, createTempDatabase, saveDatabase }: TApplyParams,
    ): Promise<TZenDatabaseBase> {
      const currentUserVersion = currentDatabase.exec(userVersion());
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
        currentDatabase.execMany(schemaOps(initSchema.tables));
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
        const nextDatabase = await createTempDatabase();
        // Init schema in database
        nextDatabase.execMany(schemaOps(schema.tables));
        const resultDb = await exec({
          schema: schema as any,
          previousSchema,
          database: nextDatabase,
          previousDatabase,
          copyTable: (fromName, toName, transform) =>
            copyTable({
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
        previousDatabase.exec(setUserVersion(previousUserVersion));
        previousSchema = schema;
      }

      const savedDatabase = await saveDatabase(previousDatabase);

      return savedDatabase;
    },
  };
}

export interface TCopyTableOptions<
  FromTable extends TTable<any, any, any>,
  ToTable extends TTable<any, any, any>,
> {
  fromDb: TZenDatabaseBase;
  toDb: TZenDatabaseBase;
  fromTable: FromTable;
  toTable: ToTable;
  transform: (
    row: TTableTypes<FromTable>["output"],
  ) => TTableTypes<ToTable>["input"];
  pageSize?: number;
}

export function copyTable<
  FromTable extends TTable<any, any, any>,
  ToTable extends TTable<any, any, any>,
>(
  {
    fromDb,
    toDb,
    fromTable,
    toTable,
    transform: tranform,
    pageSize = 100,
  }: TCopyTableOptions<FromTable, ToTable>,
) {
  const count = fromDb.exec(fromTable.query().count());
  if (count === 0) {
    return;
  }
  let done = 0;
  while (done < count) {
    const rows = fromDb.exec(
      fromTable.query().limit(Expr.literal(pageSize)).offset(Expr.literal(done))
        .all(),
    );
    if (rows.length === 0) {
      break;
    }
    const transformed = rows.map(tranform);
    toDb.exec(toTable.insertMany(transformed));
    done += rows.length;
  }
}
