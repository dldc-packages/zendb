import SqliteDatabase from 'better-sqlite3';
import * as zen from '../../src/mod';

export interface ITestDatabase {
  exec<Op extends zen.IOperation>(op: Op): zen.IOperationResult<Op>;
  execMany<Op extends zen.IOperation>(ops: Op[]): zen.IOperationResult<Op>[];
  readonly sqlDb: SqliteDatabase.Database;
}

export const TestDatabase = (() => {
  return { create };

  function create(): ITestDatabase {
    const sqlDb = new SqliteDatabase(':memory:');

    return {
      exec,
      execMany,
      sqlDb,
    };

    function exec<Op extends zen.IOperation>(op: Op): zen.IOperationResult<Op> {
      if (op.kind === 'CreateTable') {
        sqlDb.exec(op.sql);
        return opResult<zen.ICreateTableOperation>(null);
      }
      if (op.kind === 'Insert') {
        sqlDb.prepare(op.sql).run(op.params);
        return opResult<zen.IInsertOperation<any>>(op.parse());
      }
      if (op.kind === 'Delete') {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.run(op.params) : stmt.run();
        return opResult<zen.IDeleteOperation>(op.parse({ deleted: res.changes }));
      }
      if (op.kind === 'Update') {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.run(op.params) : stmt.run();
        return opResult<zen.IUpdateOperation>(op.parse({ updated: res.changes }));
      }
      if (op.kind === 'Query') {
        const stmt = sqlDb.prepare(op.sql);
        const res = op.params ? stmt.all(op.params) : stmt.all();
        return opResult<zen.IQueryOperation<any>>(op.parse(res));
      }
      if (op.kind === 'ListTables') {
        const res = sqlDb.prepare(op.sql).all();
        return opResult<zen.IListTablesOperation>(op.parse(res));
      }
      if (op.kind === 'Pragma') {
        const res = sqlDb.prepare(op.sql).all();
        return opResult<zen.IPragmaOperation<any>>(op.parse(res));
      }
      if (op.kind === 'PragmaSet') {
        sqlDb.prepare(op.sql).run();
        return opResult<zen.IPragmaSetOperation>(null);
      }
      return expectNever(op);
    }

    function opResult<Op extends zen.IOperation>(res: zen.IOperationResult<Op>): zen.IOperationResult<zen.IOperation> {
      return res;
    }

    function execMany<Op extends zen.IOperation>(ops: Op[]): zen.IOperationResult<Op>[] {
      return ops.map((op) => exec(op));
    }
  }

  function expectNever(val: never): never {
    throw new Error(`Unexpected value: ${val}`);
  }
})();
