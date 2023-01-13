import {} from 'zensqlite';
import { ISchemaAny } from '../../Schema';
import { InferSchemaTableResult } from '../../SchemaTable';
import { PRIV } from '../../Utils';
import { IColumnRef, IExpr } from './Expr';

export interface IJson<Value> {
  readonly [PRIV]: Value;
}

export type QueryColumnValuePrimitive = null | string | number | boolean | Date;

export type QueryColumnValue = QueryColumnValuePrimitive | IJson<any>;

export type ColsBase = Record<string, QueryColumnValue>;

export type SelectBase = Record<string, IExpr<any>>;

export type ColsFromSelect<Select extends SelectBase> = { [K in keyof Select]: Select[K][PRIV] };

export type QueryColumnsRef<Cols extends ColsBase> = { [K in keyof Cols]: IColumnRef<Cols[K]> };

export type FilterEqual<Cols extends ColsBase> = { [K in keyof Cols]?: Cols[K] extends QueryColumnValuePrimitive ? Cols[K] : never };

export type SelectTools<Cols extends ColsBase> = {
  joinAll<RTable extends ISelect<any>>(
    leftCol: keyof Cols,
    table: RTable,
    rightCol: keyof RTable[PRIV]
  ): IColumnRef<IJson<Array<RTable[PRIV]>>>;
  joinAll<RTable extends ISelect<any>, NewCols extends ColsBase>(
    leftCol: keyof Cols,
    table: RTable,
    rightCol: keyof RTable[PRIV],
    select: (cols: QueryColumnsRef<RTable[PRIV]>) => NewCols
  ): IColumnRef<IJson<Array<NewCols>>>;

  joinOne<RTable extends ISelect<any>>(leftCol: keyof Cols, table: RTable, rightCol: keyof RTable[PRIV]): IColumnRef<IJson<RTable[PRIV]>>;
  joinFirst<RTable extends ISelect<any>>(leftCol: keyof Cols, table: RTable, rightCol: keyof RTable[PRIV]): IColumnRef<IJson<RTable[PRIV]>>;
  joinMaybeOne<RTable extends ISelect<any>>(
    leftCol: keyof Cols,
    table: RTable,
    rightCol: keyof RTable[PRIV]
  ): IColumnRef<IJson<RTable[PRIV] | null>>;
  joinMaybeFirst<RTable extends ISelect<any>>(
    leftCol: keyof Cols,
    table: RTable,
    rightCol: keyof RTable[PRIV]
  ): IColumnRef<IJson<RTable[PRIV] | null>>;
};

export interface ISelect<Cols extends ColsBase> {
  readonly [PRIV]: Cols;

  filter(fn: (cols: QueryColumnsRef<Cols>) => IExpr<any>): ISelect<Cols>;
  filterEqual(filters: FilterEqual<Cols>): ISelect<Cols>;

  select<NewCols extends SelectBase>(
    fn: (cols: QueryColumnsRef<Cols>, tools: SelectTools<Cols>) => NewCols
  ): ISelect<ColsFromSelect<NewCols>>;

  join<RTable extends ISelect<any>, NewCols extends ColsBase>(
    leftCol: keyof Cols,
    table: RTable,
    rightCol: keyof RTable[PRIV],
    select: (lCols: QueryColumnsRef<Cols>, rCols: QueryColumnsRef<RTable[PRIV]>) => NewCols
  ): ISelect<NewCols>;
  join<RTable extends ISelect<any>>(leftCol: keyof Cols, table: RTable, rightCol: keyof RTable[PRIV]): ISelect<Cols & RTable[PRIV]>;
}

export type ITablesSelect<Schema extends ISchemaAny> = {
  [K in keyof Schema['tables']]: ISelect<InferSchemaTableResult<Schema, K>>;
};
