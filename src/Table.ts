import type { Ast } from "@dldc/sqlite";
import { builder as b, printNode } from "@dldc/sqlite";
import type { IColumnAny } from "./Column.ts";
import * as Column from "./Column.ts";
import type {
  ICreateTableOperation,
  IDeleteOperation,
  IInsertManyOperation,
  IInsertOperation,
  IUpdateOperation,
} from "./Operation.ts";
import { queryFromTable } from "./Query.ts";
import type { ITableQuery } from "./Query.types.ts";
import {
  createCannotInsertEmptyArray,
  createInvalidUniqueConstraint,
  createMissingPrimaryKey,
} from "./ZendbErreur.ts";
import type { TExprUnknow } from "./expr/Expr.ts";
import * as Expr from "./expr/Expr.ts";
import { PRIV } from "./utils/constants.ts";
import { isNotNull, mapObject } from "./utils/functions.ts";
import { extractParams } from "./utils/params.ts";
import type {
  AnyRecord,
  ColumnsBase,
  ColumnsToExprRecord,
  ColumnsToInput,
  ExprFnFromTable,
  ExprRecord,
  ExprRecordOutput,
  FilterEqualCols,
  Prettify,
} from "./utils/types.ts";
import { whereEqual } from "./utils/whereEqual.ts";

export interface ITableSchemaOptions {
  ifNotExists?: boolean;
  strict?: boolean;
}

export interface TTable<
  InputData extends AnyRecord,
  OutputCols extends ExprRecord,
> {
  schema(options?: ITableSchemaOptions): ICreateTableOperation;
  query(): ITableQuery<OutputCols, OutputCols>;
  insert(
    data: InputData,
  ): IInsertOperation<Prettify<ExprRecordOutput<OutputCols>>>;
  insertMany(
    data: InputData[],
  ): IInsertManyOperation<Prettify<ExprRecordOutput<OutputCols>>>;
  delete(condition: ExprFnFromTable<OutputCols>): IDeleteOperation;
  deleteEqual(filters: Prettify<FilterEqualCols<OutputCols>>): IDeleteOperation;
  update(
    data: Partial<InputData>,
    where?: ExprFnFromTable<OutputCols>,
  ): IUpdateOperation;
  updateEqual(
    data: Partial<InputData>,
    where: Prettify<FilterEqualCols<OutputCols>>,
  ): IUpdateOperation;
}

interface TableInfos<Cols extends ExprRecord> {
  table: Ast.Identifier;
  columnsRefs: Cols;
}

export function declare<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
): TTable<ColumnsToInput<Columns>, ColumnsToExprRecord<Columns>> {
  return {
    schema: (options) => schema(table, columns, options),
    query: () => query(table, columns),
    insert: (data) => insert(table, columns, data),
    insertMany: (data) => insertMany(table, columns, data),
    delete: (condition) => deleteFn(table, columns, condition),
    deleteEqual: (filters) => deleteEqual(table, columns, filters),
    update: (data, where) => update(table, columns, data, where),
    updateEqual: (data, options) => updateEqual(table, columns, data, options),
  };
}

export function declareMany<Tables extends Record<string, ColumnsBase>>(
  tables: Tables,
): {
  [TableName in keyof Tables]: TTable<
    ColumnsToInput<Tables[TableName]>,
    ColumnsToExprRecord<Tables[TableName]>
  >;
} {
  return Object.fromEntries(
    Object.entries(tables).map((
      [tableName, columns],
    ) => [tableName, declare(tableName, columns)]),
  ) as any;
}

function getTableInfos<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
): TableInfos<ColumnsToExprRecord<Columns>> {
  const tableIdentifier = b.Expr.identifier(table);
  const columnsRefs = mapObject(columns, (key, colDef): TExprUnknow => {
    return Expr.column(tableIdentifier, key, {
      parse: colDef[PRIV].datatype.parse,
      jsonMode: colDef[PRIV].datatype.isJson ? "JsonRef" : undefined,
      nullable: colDef[PRIV].nullable,
    });
  });
  return { table: tableIdentifier, columnsRefs };
}

export function schema<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  options: ITableSchemaOptions = {},
): ICreateTableOperation {
  const { ifNotExists = false, strict = true } = options;
  // TODO: handle IF NOT EXISTS

  const columnsEntries = Object.entries(columns);
  const primaryKeys = columnsEntries.filter(([, column]) =>
    column[PRIV].primary
  ).map(([columnName]) => columnName);
  if (primaryKeys.length === 0) {
    throw createMissingPrimaryKey(table);
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
  const uniqueTableContraints: Array<Ast.Node<"TableConstraint">> = [];
  const uniqueColumns: Array<string> = [];
  uniqueEntries.forEach(([constraintName, columns]) => {
    if (columns.length > 1) {
      uniqueTableContraints.push(
        b.CreateTableStmt.TableUnique(
          columns,
          undefined,
          constraintName ?? undefined,
        ),
      );
      return;
    }
    if (columns.length === 1) {
      uniqueColumns.push(columns[0]);
      return;
    }
    throw createInvalidUniqueConstraint(constraintName);
  });

  const tableConstraints = [
    ...(multiPrimaryKey
      ? [b.CreateTableStmt.TablePrimaryKey(primaryKeys)]
      : []),
    ...uniqueTableContraints,
  ];

  const node = b.CreateTableStmt.build(
    table,
    columnsEntries.map(([columnName, column]): Ast.Node<"ColumnDef"> => {
      const { datatype, nullable, primary } = column[PRIV];
      const unique = uniqueColumns.includes(columnName);
      const dt = datatype.type;
      return b.CreateTableStmt.ColumnDef(
        columnName,
        dt,
        [
          !nullable ? b.CreateTableStmt.NotNull() : null,
          primary && !multiPrimaryKey ? b.CreateTableStmt.PrimaryKey() : null,
          unique ? b.CreateTableStmt.Unique() : null,
        ].filter(isNotNull),
      );
    }),
    {
      strict: strict === true ? true : undefined,
      ifNotExists: ifNotExists === true ? true : undefined,
      tableConstraints: tableConstraints.length > 0
        ? tableConstraints
        : undefined,
    },
  );

  return {
    kind: "CreateTable",
    sql: printNode(node),
    params: null,
    parse: () => null,
  };
}

export function insert<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  data: ColumnsToInput<Columns>,
): IInsertOperation<ExprRecordOutput<ColumnsToExprRecord<Columns>>> {
  const { insertStatement, params, parsedData } = prepareInsert(
    table,
    columns,
    [data],
  );
  return {
    kind: "Insert",
    sql: insertStatement,
    params,
    parse: () => parsedData[0] as any,
  };
}

function insertMany<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  data: ColumnsToInput<Columns>[],
): IInsertManyOperation<ExprRecordOutput<ColumnsToExprRecord<Columns>>> {
  if (data.length === 0) {
    throw createCannotInsertEmptyArray(table);
  }
  const { insertStatement, params, parsedData } = prepareInsert(
    table,
    columns,
    data,
  );
  return {
    kind: "InsertMany",
    sql: insertStatement,
    params,
    parse: () => parsedData as any,
  };
}

export function deleteFn<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  condition: ExprFnFromTable<ColumnsToExprRecord<Columns>>,
): IDeleteOperation {
  const { columnsRefs } = getTableInfos(table, columns);
  const node = b.DeleteStmt.build(table, {
    where: condition(columnsRefs).ast,
  });
  const queryText = printNode(node);
  const params = extractParams(node);
  return { kind: "Delete", sql: queryText, params, parse: (raw) => raw };
}

export function deleteEqual<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  filters: Prettify<FilterEqualCols<ColumnsToExprRecord<Columns>>>,
): IDeleteOperation {
  return deleteFn(table, columns, (cols) => whereEqual(cols, filters));
}

export function update<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  data: Partial<ColumnsToInput<Columns>>,
  where?: ExprFnFromTable<ColumnsToExprRecord<Columns>>,
): IUpdateOperation {
  const columnsEntries: Array<[string, IColumnAny]> = Object.entries(columns)
    .filter(([name]) => {
      const input = (data as any)[name];
      return input !== undefined;
    });
  const resolvedData: Record<string, any> = {};
  columnsEntries.forEach(([name, column]) => {
    const input = (data as any)[name];
    const serialized = Column.serialize(column, input);
    resolvedData[name] = serialized;
  });
  const setItems = columnsEntries.map(
    ([name]): b.UpdateStmt.SetItem => {
      return b.UpdateStmt.ColumnName(
        name,
        Expr.external(resolvedData[name], name).ast,
      );
    },
  );
  const { columnsRefs } = getTableInfos(table, columns);
  const queryNode = b.UpdateStmt.build(table, {
    where: where ? where(columnsRefs).ast : undefined,
    setItems: setItems,
  });
  const params = extractParams(queryNode);
  const queryText = printNode(queryNode);
  return { kind: "Update", sql: queryText, params, parse: (raw) => raw };
}

export function updateEqual<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  data: Partial<ColumnsToInput<Columns>>,
  where: Prettify<FilterEqualCols<ColumnsToExprRecord<Columns>>>,
): IUpdateOperation {
  return update(
    table,
    columns,
    data,
    where ? (cols) => whereEqual(cols, where) : undefined,
  );
}

export function query<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
): ITableQuery<ColumnsToExprRecord<Columns>, ColumnsToExprRecord<Columns>> {
  const { table: tableIdentifier, columnsRefs } = getTableInfos(
    table,
    columns,
  );
  return queryFromTable(tableIdentifier, columnsRefs);
}

function prepareInsert<Columns extends ColumnsBase>(
  table: string,
  columns: Columns,
  data: ColumnsToInput<Columns>[],
) {
  const columnsEntries: Array<[string, IColumnAny]> = Object.entries(columns);
  const resolvedData: Record<string, any>[] = [];
  const parsedData: Record<string, any>[] = [];
  const values: TExprUnknow[][] = [];
  data.forEach((dataItem) => {
    const resolvedItem: Record<string, any> = {};
    const parsedItem: Record<string, any> = {};
    columnsEntries.forEach(([name, column]) => {
      const input = (dataItem as any)[name];
      const serialized = Column.serialize(column, input);
      resolvedItem[name] = serialized;
      parsedItem[name] = Column.parse(column, serialized);
    });
    const itemValues = columnsEntries.map(([name]) =>
      Expr.external(resolvedItem[name], name)
    );
    resolvedData.push(resolvedItem);
    parsedData.push(parsedItem);
    values.push(itemValues);
  });
  const cols = columnsEntries.map(([name]) => b.Expr.identifier(name));
  const queryNode = b.InsertStmt.build(table, {
    columnNames: cols,
    data: b.InsertStmt.InsertValues(
      values.map((values) => values.map((e) => e.ast)),
    ),
  });
  const params = extractParams(queryNode);
  const insertStatement = printNode(queryNode);
  return { insertStatement, params, parsedData, resolvedData };
}
