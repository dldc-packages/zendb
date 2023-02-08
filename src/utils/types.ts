import { IColumnDefAny } from '../ColumnDef';
import { IExpr } from '../Expr';
import { PRIV, TYPES } from './constants';

export type ExtractUndefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? K : never;
}[keyof Data];

export type MarkUndefinedOptional<Data extends Record<string, any>> = Pick<Data, ExtractDefinedKeys<Data>> &
  Partial<Pick<Data, ExtractUndefinedKeys<Data>>>;

export type ColumnsDefsBase = Record<string, IColumnDefAny>;

export type ITableInput<ColumnsDefs extends ColumnsDefsBase> = MarkUndefinedOptional<{
  [K in keyof ColumnsDefs]: ColumnDefInputValue<ColumnsDefs[K]>;
}>;

export type ITableResult<ColumnsDefs extends ColumnsDefsBase> = {
  [K in keyof ColumnsDefs]: ColumnDefOutputValue<ColumnsDefs[K]>;
};

export type QueryColumnValuePrimitive = null | string | number | boolean | Date;

export type ColsBase = Record<string, any>;

export type SelectBase = Record<string, IExpr<any>>;

export type ColsFromSelect<Select extends SelectBase> = { [K in keyof Select]: Select[K][TYPES] };

export type ColsRefBase = {
  [key: string]: IExpr | ColsRefBase;
};

export type ExprRecordFrom<Cols extends ColsBase> = { [K in keyof Cols]: IExpr<Cols[K]> };

export type FilterEqual<Cols extends ColsBase> = { [K in keyof Cols]?: Cols[K] extends QueryColumnValuePrimitive ? Cols[K] : never };

export type ExtractDefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? never : K;
}[keyof Data];

// Can be null if nullable and undefined if defaultValue is set
export type ColumnDefInputValue<Column extends IColumnDefAny> =
  | Column[PRIV]['datatype'][TYPES]
  | (Column[PRIV]['nullable'] extends true ? null : never)
  | (Column[PRIV]['defaultValue'] extends null ? never : undefined);

// Can be null only if nullable
export type ColumnDefOutputValue<Column extends IColumnDefAny> =
  | Column[PRIV]['datatype'][TYPES]
  | (Column[PRIV]['nullable'] extends true ? null : never);

export type ExprFromTable<Cols extends ColsBase> = (cols: ExprRecordFrom<Cols>) => IExpr<any>;