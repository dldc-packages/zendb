import { IColumnAny } from '../Column';
import { IExpr, IExprUnknow } from '../Expr';
import { PRIV, TYPES } from './constants';

export type ExtractUndefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? K : never;
}[keyof Data];

export type MarkUndefinedOptional<Data extends Record<string, any>> = Pick<Data, ExtractDefinedKeys<Data>> &
  Partial<Pick<Data, ExtractUndefinedKeys<Data>>>;

export type ColumnsBase = Record<string, IColumnAny>;

export type QueryColumnValuePrimitive = null | string | number | boolean | Date;

export type AnyRecord = Record<string, any>;

export type ExprRecord = Record<string, IExprUnknow>;

export type ExprRecordNested = { [key: string]: IExprUnknow | ExprRecordNested };

export type ExtractDefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? never : K;
}[keyof Data];

// Can be null if nullable and undefined if defaultValue is set
export type ColumnInputValue<Column extends IColumnAny> =
  | Column[PRIV]['datatype'][TYPES]
  | (Column[PRIV]['nullable'] extends true ? null : never)
  | (Column[PRIV]['defaultValue'] extends null ? never : undefined);

// Can be null only if nullable
export type ColumnOutputValue<Column extends IColumnAny> =
  | Column[PRIV]['datatype'][TYPES]
  | (Column[PRIV]['nullable'] extends true ? null : never);

export type ColumnToExpr<Column extends IColumnAny> = IExpr<Column[PRIV]['datatype'][TYPES], Column[PRIV]['nullable']>;

export type ColumnsToExprRecord<Columns extends ColumnsBase> = {
  [K in keyof Columns]: ColumnToExpr<Columns[K]>;
};

export type ExprFnFromTable<Cols extends ExprRecordNested> = (cols: Cols) => IExprUnknow;

export type ColumnsToInput<Columns extends ColumnsBase> = MarkUndefinedOptional<{
  [K in keyof Columns]: ColumnInputValue<Columns[K]>;
}>;

export type ExprResult<Val, Nullable extends boolean> = Nullable extends true ? Val | null : Val;

export type ExprResultFrom<Expr extends IExprUnknow> = ExprResult<Expr[TYPES]['val'], Expr[TYPES]['nullable']>;

export type ExprsNullables<Exprs extends IExprUnknow[]> = { [K in keyof Exprs]: Exprs[K][TYPES]['nullable'] }[number];

export type ExprRecordOutput<Select extends ExprRecord> = { [K in keyof Select]: ExprResultFrom<Select[K]> };

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type ExprRecord_MakeNullable<Exprs extends ExprRecord> = { [K in keyof Exprs]: IExpr<Exprs[K][TYPES]['val'], true> };
