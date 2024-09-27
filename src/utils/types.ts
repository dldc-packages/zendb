import type { TColumnAny } from "../Column.ts";
import type { TExpr, TExprUnknow } from "../expr/Expr.ts";
import type { PRIV, TYPES } from "./constants.ts";

export type ExtractUndefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? K : never;
}[keyof Data];

export type MarkUndefinedOptional<Data extends Record<string, any>> =
  & Pick<Data, ExtractDefinedKeys<Data>>
  & Partial<Pick<Data, ExtractUndefinedKeys<Data>>>;

export type ColumnsBase = Record<string, TColumnAny>;

export type QueryColumnValuePrimitive = null | string | number | boolean | Date;

export type AnyRecord = Record<string, any>;

export type ExprRecord = Record<string, TExprUnknow>;

export type ExprRecordNested = {
  [key: string]: TExprUnknow | ExprRecordNested;
};

export type ExtractDefinedKeys<Data extends Record<string, any>> = {
  [K in keyof Data]: undefined extends Data[K] ? never : K;
}[keyof Data];

// Can be null if nullable and undefined if defaultValue is set
export type ColumnInputValue<Column extends TColumnAny> =
  | Column[PRIV]["datatype"][TYPES]
  | (Column[PRIV]["nullable"] extends true ? null : never)
  | (Column[PRIV]["defaultValue"] extends null ? never : undefined);

// Can be null only if nullable
export type ColumnOutputValue<Column extends TColumnAny> =
  | Column[PRIV]["datatype"][TYPES]
  | (Column[PRIV]["nullable"] extends true ? null : never);

export type ColumnToExpr<Column extends TColumnAny> = TExpr<
  Column[PRIV]["datatype"][TYPES],
  Column[PRIV]["nullable"]
>;

export type ColumnsToExprRecord<Columns extends ColumnsBase> = {
  [K in keyof Columns]: ColumnToExpr<Columns[K]>;
};

export type ExprFnFromTable<Cols extends ExprRecordNested> = (
  cols: Cols,
) => TExprUnknow;

export type ColumnsToInput<Columns extends ColumnsBase> = MarkUndefinedOptional<
  {
    [K in keyof Columns]: ColumnInputValue<Columns[K]>;
  }
>;

export type ExprResult<Val, Nullable extends boolean> = Nullable extends true
  ? Val | null
  : Val;

export type ExprResultFrom<Expr extends TExprUnknow> = ExprResult<
  Expr[TYPES]["val"],
  Expr[TYPES]["nullable"]
>;

export type ExprsNullables<Exprs extends TExprUnknow[]> = {
  [K in keyof Exprs]: Exprs[K][TYPES]["nullable"];
}[number];

export type ExprRecordOutput<Select extends ExprRecord> = {
  [K in keyof Select]: ExprResultFrom<Select[K]>;
};

// deno-lint-ignore ban-types
export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type ExprRecord_MakeNullable<Exprs extends ExprRecord> = {
  [K in keyof Exprs]: TExpr<Exprs[K][TYPES]["val"], true>;
};

export type FilterEqualCols<InCols extends ExprRecordNested> = Partial<
  {
    [K in keyof InCols]: InCols[K] extends TExprUnknow
      ? { [K2 in K & string]: ExprResultFrom<InCols[K]> }
      : {
        [K2 in keyof InCols[K] as `${K & string}.${K2 & string}`]:
          InCols[K][K2] extends TExprUnknow ? ExprResultFrom<InCols[K][K2]>
            : never;
      };
  }[keyof InCols]
>;
