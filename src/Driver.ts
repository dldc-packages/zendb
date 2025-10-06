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

export interface TDriver<Db> {
  exec<Op extends TOperation>(db: Db, op: Op): TOperationResult<Op>;
  execMany<Op extends TOperation>(db: Db, ops: Op[]): TOperationResult<Op>[];
  createDatabase: () => Promise<Db> | Db;
}

/**
 * Helper to create a driver from low-level exec/prepare functions.
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
