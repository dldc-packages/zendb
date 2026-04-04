import { createInvalidLiteral } from "./ZendbErreur.ts";
import type { TYPES } from "./utils/constants.ts";
import { mapObject, maybeParseJson } from "./utils/functions.ts";

export type TSqliteDatatype = "INT" | "TEXT" | "REAL" | "BLOB";

export type TDatatypeAny = TDatatype<any, any>;

export type TDatatype<External, Internal = any> = {
  readonly [TYPES]: External;
  readonly name: string;
  readonly parse: (value: Internal) => External;
  readonly serialize: (value: External) => Internal;
  readonly type: TSqliteDatatype;
  readonly isJson?: boolean;
};

// preset
export const boolean: TDatatype<boolean, number> = create<boolean, number>({
  name: "boolean",
  parse: (value: number) => value === 1,
  serialize: (value: boolean) => (value ? 1 : 0),
  type: "INT",
});

export const integer: TDatatype<number, number> = create<number, number>({
  name: "integer",
  parse: (value: number) => value,
  serialize: (value: number) => value,
  type: "INT",
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

export const nil: TDatatype<null, null> = create<null, null>({
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
  if (val === null) return nil as any;
  if (typeof val === "string") return text as any;
  if (typeof val === "number") return number as any;
  if (typeof val === "boolean") return boolean as any;
  throw createInvalidLiteral(val);
}

export function jsonGroupArray<Item>(
  innerDatatype: TDatatype<Item, any>,
): TDatatype<Item[]> {
  return create({
    name: "jsonGroupArray",
    type: "TEXT",
    isJson: true,
    parse: (value) => {
      const arr = maybeParseJson(value) as unknown[];
      return arr.map((item: any) => innerDatatype.parse(item));
    },
    serialize: (items) => {
      return JSON.stringify(items.map((item) => innerDatatype.serialize(item)));
    },
  });
}

export function jsonObj<Items extends Record<string, any>>(
  innerDatatypes: { [K in keyof Items]: TDatatype<Items[K]> },
): TDatatype<Items> {
  return create({
    name: "jsonObj",
    type: "TEXT",
    isJson: true,
    parse: (value) => {
      const obj = maybeParseJson(value) as Record<string, any>;
      return mapObject(
        obj,
        (name, item) => innerDatatypes[name].parse(item),
      );
    },
    serialize: (obj) => {
      return JSON.stringify(
        mapObject(
          obj,
          (name, item) => innerDatatypes[name].serialize(item as any),
        ),
      );
    },
  });
}

export function create<External, Internal>(
  dt: Omit<TDatatype<External, Internal>, TYPES>,
): TDatatype<External, Internal> {
  return dt as any;
}
