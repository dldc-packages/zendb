import * as Datatype from "./Datatype.ts";
import { PRIV } from "./utils/constants.ts";
import type { ColumnInputValue, ColumnOutputValue } from "./utils/types.ts";

export type DefaultValueBase = (() => any) | null;

interface TColumnInternal<
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

export type TColumnAny = TColumn<any, boolean, DefaultValueBase>;

export interface TColumn<
  DtExt,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase,
> {
  readonly [PRIV]: TColumnInternal<DtExt, Nullable, DefaultValue>;
  nullable(): TColumn<DtExt, true, DefaultValue>;
  defaultValue<DefaultValue extends DtExt>(
    defaultValue: () => DefaultValue,
  ): TColumn<DtExt, Nullable, () => DefaultValue>;
  primary(): TColumn<DtExt, Nullable, DefaultValue>;
  unique(
    constraintName?: string | null,
  ): TColumn<DtExt, Nullable, DefaultValue>;
}

export function parse<Col extends TColumnAny>(
  column: Col,
  output: any,
): ColumnOutputValue<Col> {
  const { nullable, datatype } = column[PRIV];
  if (nullable && output === null) {
    return null as any;
  }
  return datatype.parse(output);
}

export function serialize<Col extends TColumnAny>(
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
): TColumn<DtExt, false, null> {
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
  internal: TColumnInternal<DtExt, Nullable, DefaultValue>,
): TColumn<DtExt, Nullable, DefaultValue> {
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

export function json<Obj>(): TColumn<Obj, false, null> {
  return declare(Datatype.json);
}

export function text(): TColumn<string, false, null>;
export function text<T extends string = string>(): TColumn<T, false, null>;
export function text<T extends string = string>(): TColumn<T, false, null> {
  return declare(Datatype.text as any);
}

export function number(): TColumn<number, false, null>;
export function number<T extends number = number>(): TColumn<T, false, null>;
export function number<T extends number = number>(): TColumn<T, false, null> {
  return declare(Datatype.number as any);
}

export function integer(): TColumn<number, false, null>;
export function integer<T extends number = number>(): TColumn<T, false, null>;
export function integer<T extends number = number>(): TColumn<T, false, null> {
  return declare(Datatype.integer as any);
}

export function boolean(): TColumn<boolean, false, null> {
  return declare(Datatype.boolean);
}

export function date(): TColumn<Date, false, null> {
  return declare(Datatype.date);
}
