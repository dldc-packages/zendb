import * as Datatype from "./Datatype.ts";
import { PRIV } from "./utils/constants.ts";
import type { ColumnInputValue, ColumnOutputValue } from "./utils/types.ts";

export type DefaultValueBase = (() => any) | null;

interface IColumnInternal<
  DtExt,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase,
> {
  datatype: Datatype.TDatatype<DtExt, any>;
  nullable: Nullable;
  defaultValue: DefaultValue;
  primary: boolean;
  unique: Array<{ constraintName: string | null }>;
}

export type IColumnAny = IColumn<any, boolean, DefaultValueBase>;

export interface IColumn<
  DtExt,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase,
> {
  readonly [PRIV]: IColumnInternal<DtExt, Nullable, DefaultValue>;
  nullable(): IColumn<DtExt, true, DefaultValue>;
  defaultValue<DefaultValue extends DtExt>(
    defaultValue: () => DefaultValue,
  ): IColumn<DtExt, Nullable, () => DefaultValue>;
  primary(): IColumn<DtExt, Nullable, DefaultValue>;
  unique(
    constraintName?: string | null,
  ): IColumn<DtExt, Nullable, DefaultValue>;
}

export function parse<Col extends IColumnAny>(
  column: Col,
  output: any,
): ColumnOutputValue<Col> {
  const { nullable, datatype } = column[PRIV];
  if (nullable && output === null) {
    return null as any;
  }
  return datatype.parse(output);
}

export function serialize<Col extends IColumnAny>(
  column: Col,
  input: ColumnInputValue<Col>,
): any {
  const { defaultValue, nullable, datatype } = column[PRIV];
  if (defaultValue && input === undefined) {
    return serialize(column, defaultValue());
  }
  if (nullable && input === null) {
    return null;
  }
  return datatype.serialize(input);
}

export function declare<DtExt>(
  datatype: Datatype.TDatatype<DtExt, any>,
): IColumn<DtExt, false, null> {
  return createInternal({
    datatype,
    nullable: false,
    defaultValue: null,
    primary: false,
    unique: [],
  });
}

function createInternal<
  DtExt,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase,
>(
  internal: IColumnInternal<DtExt, Nullable, DefaultValue>,
): IColumn<DtExt, Nullable, DefaultValue> {
  return {
    [PRIV]: internal,
    nullable: () => createInternal({ ...internal, nullable: true }),
    defaultValue: (defaultValue) =>
      createInternal({ ...internal, defaultValue }),
    primary: () => createInternal({ ...internal, primary: true }),
    unique: (constraintName = null) =>
      createInternal({
        ...internal,
        unique: [...internal.unique, { constraintName }],
      }),
  };
}

export function json<Obj>(): IColumn<Obj, false, null> {
  return declare(Datatype.json);
}

export function text(): IColumn<string, false, null>;
export function text<T extends string = string>(): IColumn<T, false, null>;
export function text<T extends string = string>(): IColumn<T, false, null> {
  return declare(Datatype.text as any);
}

export function number(): IColumn<number, false, null>;
export function number<T extends number = number>(): IColumn<T, false, null>;
export function number<T extends number = number>(): IColumn<T, false, null> {
  return declare(Datatype.number as any);
}

export function integer(): IColumn<number, false, null>;
export function integer<T extends number = number>(): IColumn<T, false, null>;
export function integer<T extends number = number>(): IColumn<T, false, null> {
  return declare(Datatype.integer as any);
}

export function boolean(): IColumn<boolean, false, null> {
  return declare(Datatype.boolean);
}

export function date(): IColumn<Date, false, null> {
  return declare(Datatype.date);
}
