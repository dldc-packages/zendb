import { builder as b, printNode } from 'zensqlite';
import { ResultMode } from './Database';
import { IDeleteOperation, IInsertOperation, IOperation, IUpdateOperation, ResultFromMode } from './Operation';
import { Infer, ISchemaAny } from './Schema';
import { ISchemaColumnAny, SchemaColumn } from './SchemaColumn';
import { InferSchemaTableInput, InferSchemaTableResult, ISchemaTableAny } from './SchemaTable';
import { builder, IQueryBuilder, WhereBase } from './Table/builder';
import { createSetItems } from './Table/create';
import { createWhere } from './Table/createWhere';
import { ExtractTable } from './Table/types';
import { paramsFromMap } from './Table/utils';
import { PRIV } from './Utils';

export type DeleteOptions = { limit?: number };

export type UpdateOptions<SchemaTable extends ISchemaTableAny> = {
  limit?: number;
  where?: WhereBase<SchemaTable>;
};

export interface ITable<
  Schema extends ISchemaAny,
  Mode extends ResultMode,
  TableName extends keyof Schema['tables'],
  SchemaTable extends ISchemaTableAny
> {
  query(): IQueryBuilder<Schema, Mode, TableName, ExtractTable<Schema, TableName>, null, null>;
  insert(data: InferSchemaTableInput<SchemaTable>): ResultFromMode<Mode, IInsertOperation<InferSchemaTableResult<SchemaTable>>>;
  delete(condition: WhereBase<SchemaTable>, options?: DeleteOptions): ResultFromMode<Mode, IDeleteOperation>;
  deleteOne(condition: WhereBase<SchemaTable>): ResultFromMode<Mode, IDeleteOperation>;
  update(data: Partial<Infer<SchemaTable>>, options?: UpdateOptions<SchemaTable>): ResultFromMode<Mode, IUpdateOperation>;
  updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): ResultFromMode<Mode, IUpdateOperation>;
}

export const Table = (() => {
  return { create };

  function create<
    Schema extends ISchemaAny,
    Mode extends ResultMode,
    TableName extends keyof Schema['tables'],
    SchemaTable extends ISchemaTableAny
  >(schema: Schema, operationResolver: (op: IOperation) => any, _tableName: TableName): ITable<Schema, Mode, TableName, SchemaTable> {
    const tableName = _tableName as string;
    const schemaTable = (schema.tables as any)[tableName];
    const columns: Array<[string, ISchemaColumnAny]> = Object.entries(schemaTable[PRIV].columns);
    let insertStatement: string | null = null;

    return {
      query,
      delete: deleteFn,
      deleteOne,
      insert,
      update,
      updateOne,
    };

    function query(): IQueryBuilder<Schema, Mode, TableName, ExtractTable<Schema, TableName>, null, null> {
      return builder<Schema, Mode, TableName>(schema, operationResolver, _tableName);
    }

    function insert(data: InferSchemaTableInput<SchemaTable>): ResultFromMode<Mode, IInsertOperation<InferSchemaTableResult<SchemaTable>>> {
      const resolvedData: Record<string, any> = {};
      const parsedData: Record<string, any> = {};
      columns.forEach(([name, column]) => {
        const input = (data as any)[name];
        const serialized = SchemaColumn.serialize(column, input);
        resolvedData[name] = serialized;
        parsedData[name] = SchemaColumn.parse(column, serialized);
      });
      const columnsArgs = columns.map(([name]) => resolvedData[name]);
      return operationResolver({
        kind: 'Insert',
        sql: getInsertStatement(),
        params: columnsArgs,
        parse: () => parsedData as any,
      });
    }

    function deleteFn(condition: WhereBase<SchemaTable>, options: DeleteOptions = {}): ResultFromMode<Mode, IDeleteOperation> {
      const paramsMap = new Map<any, string>();
      const queryNode = b.DeleteStmt(tableName, {
        where: createWhere(paramsMap, schemaTable, condition, tableName),
        limit: options.limit,
      });
      const queryText = printNode(queryNode);
      const params = paramsFromMap(paramsMap);
      return operationResolver({ kind: 'Delete', sql: queryText, params, parse: (raw) => raw });
    }

    function deleteOne(condition: WhereBase<SchemaTable>): ResultFromMode<Mode, IDeleteOperation> {
      return deleteFn(condition, { limit: 1 });
    }

    function update(
      data: Partial<Infer<SchemaTable>>,
      { where, limit }: UpdateOptions<SchemaTable> = {}
    ): ResultFromMode<Mode, IUpdateOperation> {
      const paramsMap = new Map<any, string>();
      // const table = this.schemaTable;
      const queryNode = b.UpdateStmt(tableName, {
        where: where ? createWhere(paramsMap, schemaTable, where, tableName) : undefined,
        limit: limit,
        setItems: createSetItems(paramsMap, schemaTable, data),
      });
      const queryText = printNode(queryNode);
      const params = paramsFromMap(paramsMap);
      return operationResolver({ kind: 'Update', sql: queryText, params, parse: (raw) => raw });
    }

    function updateOne(data: Partial<Infer<SchemaTable>>, where?: WhereBase<SchemaTable>): ResultFromMode<Mode, IUpdateOperation> {
      return update(data, { where, limit: 1 });
    }

    function getInsertStatement(): string {
      if (!insertStatement) {
        const params = columns.map(() => b.Expr.BindParameter.Indexed());
        const cols = columns.map(([col]) => b.Identifier(col));
        const queryNode = b.InsertStmt(tableName, {
          columnNames: cols,
          data: b.InsertStmtData.Values([params]),
        });
        insertStatement = printNode(queryNode);
      }
      return insertStatement;
    }
  }
})();
