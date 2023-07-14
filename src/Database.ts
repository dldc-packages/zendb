import { Ast, builder as b, printNode } from '@dldc/sqlite';
import type { ICreateTableOperation, IListTablesOperation, IPragmaOperation, IPragmaSetOperation } from './Operation';
import type { ITable, ITableSchemaOptions } from './Table';

export const Database = (() => {
  return {
    tables,
    schema,
    userVersion,
    setUserVersion,
  };

  function schema<Tables extends Record<string, ITable<any, any>>>(
    tables: Tables,
    options?: ITableSchemaOptions,
  ): Array<ICreateTableOperation> {
    return Object.values(tables).map((table) => table.schema(options));
  }

  function tables(): IListTablesOperation {
    const query = b.SelectStmt({
      resultColumns: [b.ResultColumn.column('name')],
      from: b.From.Table('sqlite_master'),
      where: b.Expr.equal(b.Expr.column('type'), b.Expr.literal('table')),
    });
    return { kind: 'ListTables', sql: printNode(query), params: null, parse: (raw) => raw.map((row) => row.name) };
  }

  function userVersion(): IPragmaOperation<number> {
    const query = Ast.createNode('PragmaStmt', { pragmaName: b.Expr.identifier('user_version') });
    return { kind: 'Pragma', sql: printNode(query), params: null, parse: (raw) => raw[0].user_version };
  }

  function setUserVersion(version: number): IPragmaSetOperation {
    const query = Ast.createNode('PragmaStmt', {
      pragmaName: b.Expr.identifier('user_version'),
      value: { variant: 'Equal', pragmaValue: b.Expr.stringLiteral(version.toString()) },
    });
    return { kind: 'PragmaSet', sql: printNode(query), params: null, parse: () => null };
  }
})();
