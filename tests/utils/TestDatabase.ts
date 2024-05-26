import { Database } from "@db/sqlite";
import type * as zen from "../../mod.ts";

export interface TTestDatabase {
  exec<Op extends zen.IOperation>(op: Op): zen.IOperationResult<Op>;
  execMany<Op extends zen.IOperation>(ops: Op[]): zen.IOperationResult<Op>[];
  readonly sqlDb: Database;
}

export const TestDatabase = (() => {
  return { create };

  function create(): TTestDatabase {
    const sqlDb = new Database(":memory:");

    return {
      exec,
      execMany,
      sqlDb,
    };

    function exec<Op extends zen.IOperation>(op: Op): zen.IOperationResult<Op> {
      if (op.kind === "CreateTable") {
        sqlDb.exec(op.sql);
        return opResult<zen.ICreateTableOperation>(null);
      }
      if (op.kind === "Insert") {
        sqlDb.prepare(op.sql).run(op.params);
        return opResult<zen.IInsertOperation<any>>(op.parse());
      }
      if (op.kind === "InsertMany") {
        sqlDb.prepare(op.sql).run(op.params);
        return opResult<zen.IInsertOperation<any>>(op.parse());
      }
      if (op.kind === "Delete") {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.run(op.params) : stmt.run();
        return opResult<zen.IDeleteOperation>(
          op.parse({ deleted: res }),
        );
      }
      if (op.kind === "Update") {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.run(op.params) : stmt.run();
        return opResult<zen.IUpdateOperation>(
          op.parse({ updated: res }),
        );
      }
      if (op.kind === "Query") {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.all(op.params) : stmt.all();
        return opResult<zen.IQueryOperation<any>>(
          op.parse(res as Record<string, any>[]),
        );
      }
      if (op.kind === "ListTables") {
        const res = sqlDb.prepare(op.sql).all();
        return opResult<zen.IListTablesOperation>(
          op.parse(res as Record<string, any>[]),
        );
      }
      if (op.kind === "Pragma") {
        const res = sqlDb.prepare(op.sql).all();
        return opResult<zen.IPragmaOperation<any>>(
          op.parse(res as Record<string, any>[]),
        );
      }
      if (op.kind === "PragmaSet") {
        sqlDb.prepare(op.sql).run();
        return opResult<zen.IPragmaSetOperation>(null);
      }
      return expectNever(op);
    }

    function opResult<Op extends zen.IOperation>(
      res: zen.IOperationResult<Op>,
    ): zen.IOperationResult<zen.IOperation> {
      return res;
    }

    function execMany<Op extends zen.IOperation>(
      ops: Op[],
    ): zen.IOperationResult<Op>[] {
      return ops.map((op) => exec(op));
    }
  }

  function expectNever(val: never): never {
    throw new Error(`Unexpected value: ${val as any}`);
  }
})();
