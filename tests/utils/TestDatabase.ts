import { Database } from "@db/sqlite";
import type * as zen from "../../mod.ts";
import type { TZenDatabaseBase } from "../../src/Database.ts";

export interface TTestDatabase extends TZenDatabaseBase {
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

    function exec<Op extends zen.TOperation>(op: Op): zen.TOperationResult<Op> {
      if (op.kind === "CreateTable") {
        sqlDb.exec(op.sql);
        return opResult<zen.TCreateTableOperation>(null);
      }
      if (op.kind === "DropTable") {
        sqlDb.exec(op.sql);
        return opResult<zen.TCreateTableOperation>(null);
      }
      if (op.kind === "Insert") {
        sqlDb.prepare(op.sql).run(op.params);
        return opResult<zen.TInsertOperation<any>>(op.parse());
      }
      if (op.kind === "InsertMany") {
        sqlDb.prepare(op.sql).run(op.params);
        return opResult<zen.TInsertOperation<any>>(op.parse());
      }
      if (op.kind === "Delete") {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.run(op.params) : stmt.run();
        return opResult<zen.TDeleteOperation>(
          op.parse({ deleted: res }),
        );
      }
      if (op.kind === "Update") {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.run(op.params) : stmt.run();
        return opResult<zen.TUpdateOperation>(
          op.parse({ updated: res }),
        );
      }
      if (op.kind === "Query") {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.all(op.params) : stmt.all();
        return opResult<zen.TQueryOperation<any>>(
          op.parse(res as Record<string, any>[]),
        );
      }
      if (op.kind === "ListTables") {
        const res = sqlDb.prepare(op.sql).all();
        return opResult<zen.TListTablesOperation>(
          op.parse(res as Record<string, any>[]),
        );
      }
      if (op.kind === "Pragma") {
        const res = sqlDb.prepare(op.sql).all();
        return opResult<zen.TPragmaOperation<any>>(
          op.parse(res as Record<string, any>[]),
        );
      }
      if (op.kind === "PragmaSet") {
        sqlDb.prepare(op.sql).run();
        return opResult<zen.TPragmaSetOperation>(null);
      }
      return expectNever(op);
    }

    function opResult<Op extends zen.TOperation>(
      res: zen.TOperationResult<Op>,
    ): zen.TOperationResult<zen.TOperation> {
      return res;
    }

    function execMany<Op extends zen.TOperation>(
      ops: Op[],
    ): zen.TOperationResult<Op>[] {
      return ops.map((op) => exec(op));
    }
  }

  function expectNever(val: never): never {
    throw new Error(`Unexpected value: ${val as any}`);
  }
})();
