import type { Ast } from '@dldc/sqlite';
import { builder as b, printNode } from '@dldc/sqlite';
import type { IColumnAny } from './Column';
import { Column } from './Column';
import type { IExprUnknow } from './Expr';
import { Expr } from './Expr';
import type { ICreateTableOperation, IDeleteOperation, IInsertOperation, IUpdateOperation } from './Operation';
import { TableQuery } from './TableQuery';
import type { ITableQuery } from './TableQuery.types';
import { ZendbErreur } from './ZendbErreur';
import { PRIV } from './utils/constants';
import { createSetItems } from './utils/createSetItems';
import { extractParams } from './utils/params';
import type {
  AnyRecord,
  ColumnsBase,
  ColumnsToExprRecord,
  ColumnsToInput,
  ExprFnFromTable,
  ExprRecord,
  ExprRecordOutput,
  Prettify,
} from './utils/types';
import { isNotNull, mapObject } from './utils/utils';

export type UpdateOptions<Cols extends AnyRecord> = {
  limit?: number;
  where?: ExprFnFromTable<Cols>;
};

export interface ITableSchemaOptions {
  ifNotExists?: boolean;
  strict?: boolean;
}

export interface ITable<InputData extends AnyRecord, OutputCols extends ExprRecord> {
  schema(options?: ITableSchemaOptions): ICreateTableOperation;
  query(): ITableQuery<OutputCols, OutputCols>;
  insert(data: InputData): IInsertOperation<Prettify<ExprRecordOutput<OutputCols>>>;
  delete(condition: ExprFnFromTable<OutputCols>): IDeleteOperation;
  update(data: Partial<InputData>, options?: UpdateOptions<OutputCols>): IUpdateOperation;
  updateOne(data: Partial<InputData>, where?: ExprFnFromTable<OutputCols>): IUpdateOperation;
}

interface TableInfos<Cols extends ExprRecord> {
  table: Ast.Identifier;
  columnsRefs: Cols;
}

export const Table = (() => {
  return {
    declare,
    declareMany,

    schema,
    query,
    insert,
    delete: deleteFn,
    update,
    updateOne,

    from: TableQuery.createCteFrom,
  };

  function declare<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
  ): ITable<ColumnsToInput<Columns>, ColumnsToExprRecord<Columns>> {
    return {
      schema: (options) => schema(table, columns, options),
      query: () => query(table, columns),
      insert: (data) => insert(table, columns, data),
      delete: (condition) => deleteFn(table, columns, condition),
      update: (data, options) => update(table, columns, data, options),
      updateOne: (data, where) => updateOne(table, columns, data, where),
    };
  }

  function declareMany<Tables extends Record<string, ColumnsBase>>(
    tables: Tables,
  ): {
    [TableName in keyof Tables]: ITable<ColumnsToInput<Tables[TableName]>, ColumnsToExprRecord<Tables[TableName]>>;
  } {
    return Object.fromEntries(
      Object.entries(tables).map(([tableName, columns]) => [tableName, Table.declare(tableName, columns)]),
    ) as any;
  }

  function getTableInfos<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
  ): TableInfos<ColumnsToExprRecord<Columns>> {
    const tableIdentifier = b.Expr.identifier(table);
    const columnsRefs = mapObject(columns, (key, colDef): IExprUnknow => {
      return Expr.column(tableIdentifier, key, {
        parse: colDef[PRIV].datatype.parse,
        jsonMode: colDef[PRIV].datatype.isJson ? 'JsonRef' : undefined,
        nullable: colDef[PRIV].nullable,
      });
    });
    return { table: tableIdentifier, columnsRefs };
  }

  function schema<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
    options: ITableSchemaOptions = {},
  ): ICreateTableOperation {
    const { ifNotExists = false, strict = true } = options;
    // TODO: handle IF NOT EXISTS

    const columnsEntries = Object.entries(columns);
    const primaryKeys = columnsEntries.filter(([, column]) => column[PRIV].primary).map(([columnName]) => columnName);
    if (primaryKeys.length === 0) {
      throw ZendbErreur.MissingPrimaryKey(table);
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
      throw ZendbErreur.InvalidUniqueConstraint(constraintName);
    });

    const tableConstraints = [
      ...(multiPrimaryKey ? [b.TableConstraint.PrimaryKey(primaryKeys)] : []),
      ...uniqueTableContraints,
    ];

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
          ].filter(isNotNull),
        );
      }),
      {
        strict: strict === true ? true : undefined,
        ifNotExists: ifNotExists === true ? true : undefined,
        tableConstraints: tableConstraints.length > 0 ? tableConstraints : undefined,
      },
    );

    return { kind: 'CreateTable', sql: printNode(node), params: null, parse: () => null };
  }

  function insert<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
    data: ColumnsToInput<Columns>,
  ): IInsertOperation<ExprRecordOutput<ColumnsToExprRecord<Columns>>> {
    const columnsEntries: Array<[string, IColumnAny]> = Object.entries(columns);
    const resolvedData: Record<string, any> = {};
    const parsedData: Record<string, any> = {};
    columnsEntries.forEach(([name, column]) => {
      const input = (data as any)[name];
      const serialized = Column.serialize(column, input);
      resolvedData[name] = serialized;
      parsedData[name] = Column.parse(column, serialized);
    });
    const values = columnsEntries.map(([name]) => Expr.external(resolvedData[name], name));
    const cols = columnsEntries.map(([name]) => b.Expr.identifier(name));
    const queryNode = b.InsertStmt(table, {
      columnNames: cols,
      data: b.InsertStmtData.Values([values.map((e) => e.ast)]),
    });
    const params = extractParams(queryNode);
    const insertStatement = printNode(queryNode);
    return {
      kind: 'Insert',
      sql: insertStatement,
      params,
      parse: () => parsedData as any,
    };
  }

  function deleteFn<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
    condition: ExprFnFromTable<ColumnsToExprRecord<Columns>>,
  ): IDeleteOperation {
    const { columnsRefs } = getTableInfos(table, columns);
    const node = b.DeleteStmt(table, { where: condition(columnsRefs).ast });
    const queryText = printNode(node);
    const params = extractParams(node);
    return { kind: 'Delete', sql: queryText, params, parse: (raw) => raw };
  }

  function update<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
    data: Partial<ColumnsToInput<Columns>>,
    { where, limit }: UpdateOptions<ColumnsToExprRecord<Columns>> = {},
  ): IUpdateOperation {
    const { columnsRefs } = getTableInfos(table, columns);
    const queryNode = b.UpdateStmt(table, {
      where: where ? where(columnsRefs).ast : undefined,
      limit: limit,
      setItems: createSetItems(columns, data),
    });
    const params = extractParams(queryNode);
    const queryText = printNode(queryNode);
    return { kind: 'Update', sql: queryText, params, parse: (raw) => raw };
  }

  function updateOne<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
    data: Partial<ColumnsToInput<Columns>>,
    where?: ExprFnFromTable<ColumnsToExprRecord<Columns>>,
  ): IUpdateOperation {
    return update(table, columns, data, { where, limit: 1 });
  }

  function query<Columns extends ColumnsBase>(
    table: string,
    columns: Columns,
  ): ITableQuery<ColumnsToExprRecord<Columns>, ColumnsToExprRecord<Columns>> {
    const { table: tableIdentifier, columnsRefs } = getTableInfos(table, columns);
    return TableQuery.createFromTable(tableIdentifier, columnsRefs);
  }
})();
