export interface IDeleteOperation {
  kind: 'Delete';
  sql: string;
  params: Record<string, any> | null;
}

export interface IUpdateOperation {
  kind: 'Update';
  sql: string;
  params: Record<string, any> | null;
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

export type IOperation = IDeleteOperation | IUpdateOperation | IInsertOperation<any> | IQueryOperation<any>;

export type IOperationKind = IOperation['kind'];
