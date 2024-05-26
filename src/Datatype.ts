import { createInvalidLiteral } from "./ZendbErreur.ts";
import type { TYPES } from "./utils/constants.ts";
import { maybeParseJson } from "./utils/functions.ts";

export type TSqliteDatatype = "INTEGER" | "TEXT" | "REAL" | "BLOB";

export type TDatatypeAny = TDatatype<any, any>;

export type TDatatype<External, Internal = any> = {
  [TYPES]: External;
  name: string;
  parse: (value: Internal) => External;
  serialize: (value: External) => Internal;
  type: TSqliteDatatype;
  isJson?: boolean;
};

// preset
export const boolean: TDatatype<boolean, number> = create<boolean, number>({
  name: "boolean",
  parse: (value: number) => value === 1,
  serialize: (value: boolean) => (value ? 1 : 0),
  type: "INTEGER",
});

export const integer: TDatatype<number, number> = create<number, number>({
  name: "integer",
  parse: (value: number) => value,
  serialize: (value: number) => value,
  type: "INTEGER",
});

export const number: TDatatype<number, number> = create<number, number>({
  name: "number",
  parse: (value: number) => value,
  serialize: (value: number) => value,
  type: "REAL",
});

export const text: TDatatype<string, string> = create<string, string>({
  name: "text",
  parse: (value: string) => value,
  serialize: (value: string) => value,
  type: "TEXT",
});

export const date: TDatatype<Date, number> = create<Date, number>({
  name: "date",
  parse: (value: number) => new Date(value),
  serialize: (value: Date) => value.getTime(),
  type: "REAL",
});

export const json: TDatatype<any, string> = create<any, string>({
  name: "json",
  parse: (value: string) => maybeParseJson(value),
  serialize: (value: any) => JSON.stringify(value),
  type: "TEXT",
  isJson: true,
});

export const nill: TDatatype<null, null> = create<null, null>({
  name: "null",
  parse: () => null,
  serialize: () => null,
  type: "TEXT",
});

export const any: TDatatype<any, any> = create<any, any>({
  name: "any",
  parse: (value: any) => value,
  serialize: (value: any) => value,
  type: "TEXT",
});

export function fromLiteral<Val extends string | number | boolean | null>(
  val: Val,
): TDatatype<Val> {
  if (val === null) return nill as any;
  if (typeof val === "string") return text as any;
  if (typeof val === "number") return number as any;
  if (typeof val === "boolean") return boolean as any;
  throw createInvalidLiteral(val);
}

export function create<External, Internal>(
  dt: Omit<TDatatype<External, Internal>, TYPES>,
): TDatatype<External, Internal> {
  return dt as any;
}
