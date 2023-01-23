import { Ast, builder as b, printNode } from 'zensqlite';
import { ColumnDef, IColumnDefAny } from './ColumnDef';
import { ICreateTableOperation, IDeleteOperation, IInsertOperation, IUpdateOperation } from './Operation';
import { ITableQuery, TableQuery } from './TableQuery';
import { PRIV } from './utils/constants';
import { createSetItems } from './utils/createSetItems';
import { extractExprParams } from './utils/extractExprParams';
import { ColsBase, ColumnsDefsBase, ExprFromTable, ITableInput, ITableResult } from './utils/types';
import { isNotNull, paramsFromMap } from './utils/utils';

export type DeleteOptions = { limit?: number };

export type UpdateOptions<Cols extends ColsBase> = {
  limit?: number;
  where?: ExprFromTable<Cols>;
};

export interface ICreateTableOptions {
  ifNotExists?: boolean;
  strict?: boolean;
}

export interface ITable<InputCols extends ColsBase, OutputCols extends ColsBase> {
  createTable(options?: ICreateTableOptions): ICreateTableOperation;
  query(): ITableQuery<OutputCols>;
  insert(data: InputCols): IInsertOperation<OutputCols>;
  delete(condition: ExprFromTable<OutputCols>, options?: DeleteOptions): IDeleteOperation;
  deleteOne(condition: ExprFromTable<OutputCols>): IDeleteOperation;
  update(data: Partial<OutputCols>, options?: UpdateOptions<OutputCols>): IUpdateOperation;
  updateOne(data: Partial<OutputCols>, where?: ExprFromTable<OutputCols>): IUpdateOperation;
}

export const Table = (() => {
  return Object.assign(create, {
    insert,
    delete: deleteFn,
    deleteOne,
    update,
    updateOne,
  });

  function createTable<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs,
    options: ICreateTableOptions = {}
  ): ICreateTableOperation {
    const { ifNotExists = false, strict = true } = options;
    // TODO: handle IF NOT EXISTS

    const columnsEntries = Object.entries(columns);
    const primaryKeys = columnsEntries.filter(([, column]) => column[PRIV].primary).map(([columnName]) => columnName);
    if (primaryKeys.length === 0) {
      throw new Error(`No primary key found for table ${table}`);
    }
    const multiPrimaryKey = primaryKeys.length > 1;
    const uniqueContraints = new Map<string | null, Array<string>>();
    columnsEntries.forEach(([columnName, column]) => {
      const { unique } = column[PRIV];
      unique.forEach(({ constraintName }) => {
        const keys = uniqueContraints.get(constraintName) || [];
        uniqueContraints.set(constraintName, [...keys, columnName]);
      });
    });

    const uniqueEntries = Array.from(uniqueContraints.entries());
    const uniqueTableContraints: Array<Ast.Node<'TableConstraint'>> = [];
    const uniqueColumns: Array<string> = [];
    uniqueEntries.forEach(([constraintName, columns]) => {
      if (columns.length > 1) {
        uniqueTableContraints.push(b.TableConstraint.Unique(columns, undefined, constraintName ?? undefined));
        return;
      }
      if (columns.length === 1) {
        uniqueColumns.push(columns[0]);
        return;
      }
      throw new Error(`Invalid unique constraint ${constraintName}`);
    });

    const tableConstraints = [...(multiPrimaryKey ? [b.TableConstraint.PrimaryKey(primaryKeys)] : []), ...uniqueTableContraints];

    const node = b.CreateTableStmt(
      table,
      columnsEntries.map(([columnName, column]): Ast.Node<'ColumnDef'> => {
        const { datatype, nullable, primary } = column[PRIV];
        const unique = uniqueColumns.includes(columnName);
        const dt = datatype.type;
        return b.ColumnDef(
          columnName,
          dt,
          [
            !nullable ? b.ColumnConstraint.NotNull() : null,
            primary && !multiPrimaryKey ? b.ColumnConstraint.PrimaryKey() : null,
            unique ? b.ColumnConstraint.Unique() : null,
          ].filter(isNotNull)
        );
      }),
      {
        strict: strict === true ? true : undefined,
        ifNotExists: ifNotExists === true ? true : undefined,
        tableConstraints: tableConstraints.length > 0 ? tableConstraints : undefined,
      }
    );

    return { kind: 'CreateTable', sql: printNode(node), params: null, parse: () => null };
  }

  function create<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs
  ): ITable<ITableInput<ColumnsDefs>, ITableResult<ColumnsDefs>> {
    return {
      createTable: (options) => createTable(table, columns, options),
      query: () => query(table, columns),
      insert: (data) => insert(table, columns, data),
      delete: (condition, options) => deleteFn(table, columns, condition, options),
      deleteOne: (condition) => deleteOne(table, columns, condition),
      update: (data, options) => update(table, columns, data, options),
      updateOne: (data, where) => updateOne(table, columns, data, where),
    };
  }

  function insert<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs,
    data: ITableInput<ColumnsDefs>
  ): IInsertOperation<ITableResult<ColumnsDefs>> {
    const columnsEntries: Array<[string, IColumnDefAny]> = Object.entries(columns);
    const resolvedData: Record<string, any> = {};
    const parsedData: Record<string, any> = {};
    columnsEntries.forEach(([name, column]) => {
      const input = (data as any)[name];
      const serialized = ColumnDef.serialize(column, input);
      resolvedData[name] = serialized;
      parsedData[name] = ColumnDef.parse(column, serialized);
    });
    const columnsArgs = columnsEntries.map(([name]) => resolvedData[name]);
    const params = columnsEntries.map(() => b.Expr.BindParameter.indexed());
    const cols = columnsEntries.map(([col]) => b.Expr.identifier(col));
    const queryNode = b.InsertStmt(table, {
      columnNames: cols,
      data: b.InsertStmtData.Values([params]),
    });
    const insertStatement = printNode(queryNode);
    return {
      kind: 'Insert',
      sql: insertStatement,
      params: columnsArgs,
      parse: () => parsedData as any,
    };
  }

  function deleteFn<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs,
    condition: ExprFromTable<ITableResult<ColumnsDefs>>,
    options: DeleteOptions = {}
  ): IDeleteOperation {
    const paramsMap = new Map<any, string>();
    const tableQuery = TableQuery.createFromTable(table, columns);
    const queryNode = b.DeleteStmt(table, {
      where: condition ? extractExprParams(condition(tableQuery[PRIV].columnsRef), paramsMap) : undefined,
      limit: options.limit,
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    return { kind: 'Delete', sql: queryText, params, parse: (raw) => raw };
  }

  function deleteOne<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs,
    condition: ExprFromTable<ITableResult<ColumnsDefs>>
  ): IDeleteOperation {
    return deleteFn(table, columns, condition, { limit: 1 });
  }

  function update<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs,
    data: Partial<ITableInput<ColumnsDefs>>,
    { where, limit }: UpdateOptions<ITableResult<ColumnsDefs>> = {}
  ): IUpdateOperation {
    const paramsMap = new Map<any, string>();
    const tableQuery = TableQuery.createFromTable(table, columns);
    const queryNode = b.UpdateStmt(table, {
      where: where ? extractExprParams(where(tableQuery[PRIV].columnsRef), paramsMap) : undefined,
      limit: limit,
      setItems: createSetItems(paramsMap, columns, data),
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    return { kind: 'Update', sql: queryText, params, parse: (raw) => raw };
  }

  function updateOne<ColumnsDefs extends ColumnsDefsBase>(
    table: string,
    columns: ColumnsDefs,
    data: Partial<ITableInput<ColumnsDefs>>,
    where?: ExprFromTable<ITableResult<ColumnsDefs>>
  ): IUpdateOperation {
    return update(table, columns, data, { where, limit: 1 });
  }

  function query<ColumnsDefs extends ColumnsDefsBase>(table: string, columns: ColumnsDefs): ITableQuery<ITableResult<ColumnsDefs>> {
    return TableQuery.createFromTable(table, columns);
  }
})();
