import { builder as b, printNode } from 'zensqlite';
import { ICreateTableOperation, IListTablesOperation } from './Operation';
import { ICreateTableOptions, ITable, Table } from './Table';
import { ColumnsDefsBase, ITableInput, ITableResult } from './utils/types';

export const Database = (() => {
  return Object.assign(create, {
    listTables,
    createTables,
  });

  function create<Tables extends Record<string, ColumnsDefsBase>>(
    tables: Tables
  ): { [TableName in keyof Tables]: ITable<ITableInput<Tables[TableName]>, ITableResult<Tables[TableName]>> } {
    return Object.fromEntries(Object.entries(tables).map(([tableName, columns]) => [tableName, Table.create(tableName, columns)])) as any;
  }

  function createTables<Tables extends Record<string, ITable<any, any>>>(
    tables: Tables,
    options?: ICreateTableOptions
  ): Array<ICreateTableOperation> {
    return Object.values(tables).map((table) => table.createTable(options));
  }

  function listTables(): IListTablesOperation {
    const query = b.SelectStmt({
      resultColumns: [b.ResultColumn.column('name')],
      from: b.From.Table('sqlite_master'),
      where: b.Expr.equal(b.Expr.column('type'), b.Expr.literal('table')),
    });
    return { kind: 'ListTables', sql: printNode(query), params: null, parse: (raw) => raw.map((row) => row.name) };
  }
})();
