import type {
  TCreateTableOperation,
  TDeleteOperation,
  TInsertOperation,
  TListTablesOperation,
  TOperation,
  TOperationResult,
  TPragmaOperation,
  TPragmaSetOperation,
  TQueryOperation,
  TUpdateOperation,
} from "./Operation.ts";

/**
 * A driver is responsible for executing ZenDB operations on a database instance.
 *
 * Drivers provide a consistent interface across different SQLite libraries
 * (Node.js, Deno, Browser) while maintaining type safety and performance.
 */
export interface TDriver<Db> {
  /**
   * Executes a single operation on the database.
   *
   * @param db - The database instance
   * @param op - The operation to execute
   * @returns The typed result of the operation
   */
  exec<Op extends TOperation>(db: Db, op: Op): TOperationResult<Op>;

  /**
   * Executes multiple operations on the database.
   *
   * @param db - The database instance
   * @param ops - Array of operations to execute
   * @returns Array of typed results
   */
  execMany<Op extends TOperation>(db: Db, ops: Op[]): TOperationResult<Op>[];

  /**
   * Creates a new database instance (used internally by migrations).
   *
   * @returns A new database instance
   */
  createDatabase: () => Promise<Db> | Db;
}

/**
 * Helper to create a driver from low-level exec/prepare functions.
 *
 * This is the easiest way to create a custom driver for a new SQLite library.
 * The helper handles all operation types automatically based on prepared statements.
 *
 * @param config - Configuration object with database operations
 * @returns A fully functional driver
 *
 * @example
 * ```ts
 * import { Driver } from "@dldc/zendb";
 * import type { Database } from "your-sqlite-library";
 *
 * export const MyDriver = Driver.createDriverFromPrepare<Database>({
 *   exec: (db, sql) => db.exec(sql),
 *   prepare: (db, sql) => {
 *     const stmt = db.prepare(sql);
 *     return {
 *       run: (params) => stmt.run(params).changes,
 *       all: (params) => stmt.all(params)
 *     };
 *   },
 *   createDatabase: () => new Database(":memory:")
 * });
 * ```
 */
export function createDriverFromPrepare<Db>(config: {
  exec: (db: Db, sql: string) => void;
  prepare: (db: Db, sql: string) => {
    run: (params?: any) => number;
    all: (params?: any) => any[];
  };
  createDatabase: () => Db | Promise<Db>;
}): TDriver<Db> {
  return {
    exec,
    execMany,
    createDatabase: config.createDatabase,
  };

  function exec<Op extends TOperation>(
    db: Db,
    op: Op,
  ): TOperationResult<Op> {
    if (op.kind === "CreateTable") {
      config.exec(db, op.sql);
      return opResult<TCreateTableOperation>(null);
    }
    if (op.kind === "DropTable") {
      config.exec(db, op.sql);
      return opResult<TCreateTableOperation>(null);
    }
    if (op.kind === "Insert") {
      config.prepare(db, op.sql).run(op.params);
      return opResult<TInsertOperation<any>>(op.parse());
    }
    if (op.kind === "InsertMany") {
      config.prepare(db, op.sql).run(op.params);
      return opResult<TInsertOperation<any>>(op.parse());
    }
    if (op.kind === "Delete") {
      const stmt = config.prepare(db, op.sql);
      const res = op.params ? stmt.run(op.params) : stmt.run();
      return opResult<TDeleteOperation>(
        op.parse({ deleted: res }),
      );
    }
    if (op.kind === "Update") {
      const stmt = config.prepare(db, op.sql);
      const res = op.params ? stmt.run(op.params) : stmt.run();
      return opResult<TUpdateOperation>(
        op.parse({ updated: res }),
      );
    }
    if (op.kind === "Query") {
      const stmt = config.prepare(db, op.sql);
      const res = op.params ? stmt.all(op.params) : stmt.all();
      return opResult<TQueryOperation<any>>(
        op.parse(res as Record<string, any>[]),
      );
    }
    if (op.kind === "ListTables") {
      const res = config.prepare(db, op.sql).all();
      return opResult<TListTablesOperation>(
        op.parse(res as Record<string, any>[]),
      );
    }
    if (op.kind === "Pragma") {
      const res = config.prepare(db, op.sql).all();
      return opResult<TPragmaOperation<any>>(
        op.parse(res as Record<string, any>[]),
      );
    }
    if (op.kind === "PragmaSet") {
      config.prepare(db, op.sql).run();
      return opResult<TPragmaSetOperation>(null);
    }
    throw new Error(`Unexpected value: ${op as any}`);
  }

  function opResult<Op extends TOperation>(
    res: TOperationResult<Op>,
  ): TOperationResult<TOperation> {
    return res;
  }

  function execMany<Op extends TOperation>(
    db: Db,
    ops: Op[],
  ): TOperationResult<Op>[] {
    return ops.map((op) => exec(db, op));
  }
}
