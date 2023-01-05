import { builder as b, printNode } from 'zensqlite';
import { IDeleteOperation, IInsertOperation, IUpdateOperation } from './Operation';
import { Infer, ISchemaAny } from './Schema';
import { ISchemaColumnAny, SchemaColumn } from './SchemaColumn';
import { InferSchemaTableInput, InferSchemaTableResult } from './SchemaTable';
import { createSetItems } from './Table/create';
import { createWhere } from './Table/createWhere';
import { IQueryBuilder, queryBuilder, WhereBase } from './Table/queryBuilder';
import { getSchemaTable, paramsFromMap } from './Table/utils';
import { TablesNames } from './types';
import { PRIV } from './Utils';

export type DeleteOptions = { limit?: number };

export type UpdateOptions<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = {
  limit?: number;
  where?: WhereBase<Schema, TableName>;
};

export interface ITable<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> {
  query(): IQueryBuilder<Schema, TableName, null, null>;
  insert(data: InferSchemaTableInput<Schema, TableName>): IInsertOperation<InferSchemaTableResult<Schema, TableName>>;
  delete(condition: WhereBase<Schema, TableName>, options?: DeleteOptions): IDeleteOperation;
  deleteOne(condition: WhereBase<Schema, TableName>): IDeleteOperation;
  update(data: Partial<Infer<Schema, TableName>>, options?: UpdateOptions<Schema, TableName>): IUpdateOperation;
  updateOne(data: Partial<Infer<Schema, TableName>>, where?: WhereBase<Schema, TableName>): IUpdateOperation;
}

export const Table = (() => {
  return {
    create,

    query: queryBuilder,
    insert,
    delete: deleteFn,
    deleteOne: deleteOne,
    update,
    updateOne,
  };

  function create<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
    schema: Schema,
    table: TableName
  ): ITable<Schema, TableName> {
    return {
      query: () => queryBuilder(schema, table),
      insert: (data) => insert(schema, table, data),
      delete: (condition, options) => deleteFn(schema, table, condition, options),
      deleteOne: (condition) => deleteOne(schema, table, condition),
      update: (data, options) => update(schema, table, data, options),
      updateOne: (data, where) => updateOne(schema, table, data, where),
    };
  }

  function insert<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
    schema: Schema,
    table: TableName,
    data: InferSchemaTableInput<Schema, TableName>
  ): IInsertOperation<InferSchemaTableResult<Schema, TableName>> {
    const tableSchema = getSchemaTable(schema, table);
    const columns: Array<[string, ISchemaColumnAny]> = Object.entries(tableSchema[PRIV].columns);
    const resolvedData: Record<string, any> = {};
    const parsedData: Record<string, any> = {};
    columns.forEach(([name, column]) => {
      const input = (data as any)[name];
      const serialized = SchemaColumn.serialize(column, input);
      resolvedData[name] = serialized;
      parsedData[name] = SchemaColumn.parse(column, serialized);
    });
    const columnsArgs = columns.map(([name]) => resolvedData[name]);
    const params = columns.map(() => b.Expr.BindParameter.Indexed());
    const cols = columns.map(([col]) => b.Identifier(col));
    const queryNode = b.InsertStmt(table as string, {
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

  function deleteFn<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
    schema: Schema,
    table: TableName,
    condition: WhereBase<Schema, TableName>,
    options: DeleteOptions = {}
  ): IDeleteOperation {
    const paramsMap = new Map<any, string>();
    const schemaTable = getSchemaTable(schema, table);
    const queryNode = b.DeleteStmt(table as string, {
      where: createWhere(paramsMap, schemaTable, condition, table as string),
      limit: options.limit,
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    return { kind: 'Delete', sql: queryText, params, parse: (raw) => raw };
  }

  function deleteOne<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
    schema: Schema,
    table: TableName,
    condition: WhereBase<Schema, TableName>
  ): IDeleteOperation {
    return deleteFn(schema, table, condition, { limit: 1 });
  }

  function update<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
    schema: Schema,
    table: TableName,
    data: Partial<Infer<Schema, TableName>>,
    { where, limit }: UpdateOptions<Schema, TableName> = {}
  ): IUpdateOperation {
    const paramsMap = new Map<any, string>();
    const schemaTable = getSchemaTable(schema, table);
    const queryNode = b.UpdateStmt(table as string, {
      where: where ? createWhere(paramsMap, schemaTable, where, table as string) : undefined,
      limit: limit,
      setItems: createSetItems(paramsMap, schemaTable, data),
    });
    const queryText = printNode(queryNode);
    const params = paramsFromMap(paramsMap);
    return { kind: 'Update', sql: queryText, params, parse: (raw) => raw };
  }

  function updateOne<Schema extends ISchemaAny, TableName extends TablesNames<Schema>>(
    schema: Schema,
    table: TableName,
    data: Partial<Infer<Schema, TableName>>,
    where?: WhereBase<Schema, TableName>
  ): IUpdateOperation {
    return update(schema, table, data, { where, limit: 1 });
  }
})();
