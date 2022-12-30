import { ResultMode } from './Database';

export interface IDeleteOperation {
  kind: 'Delete';
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: { deleted: number }) => { deleted: number };
}

export interface IUpdateOperation {
  kind: 'Update';
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: { updated: number }) => { updated: number };
}

export interface IInsertOperation<Inserted> {
  kind: 'Insert';
  sql: string;
  params: Array<any>;
  parse: () => Inserted;
}

export interface IQueryOperation<Result> {
  kind: 'Query';
  sql: string;
  params: Record<string, any> | null;
  parse: (raw: Array<Record<string, any>>) => Result;
}

export interface ICreateTableOperation {
  kind: 'CreateTable';
  sql: string;
  params: null;
  parse: () => null;
}

export interface IListTablesOperation {
  kind: 'ListTables';
  sql: string;
  params: null;
  parse: (raw: Array<Record<string, any>>) => Array<string>;
}

export type IOperation =
  | IDeleteOperation
  | IUpdateOperation
  | IInsertOperation<any>
  | IQueryOperation<any>
  | ICreateTableOperation
  | IListTablesOperation;

export type IOperationKind = IOperation['kind'];

export type ResultFromMode<Mode extends ResultMode, Op extends IOperation> = Mode extends 'Operation'
  ? Op
  : Mode extends 'Result'
  ? ReturnType<Op['parse']>
  : Mode extends 'AsyncResult'
  ? Promise<ReturnType<Op['parse']>>
  : never;
