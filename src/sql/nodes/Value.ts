import * as zod from 'zod';
import { mapObject, PRIV } from '../../Utils';
import { Datatype, DatatypeAny, DatatypeParsed } from './Datatype';

export type DefaultValueBase = (() => any) | null;

export type ValueAny = Value<DatatypeAny, boolean, DefaultValueBase>;

export type ValuesAny = Record<string, ValueAny>;

export type ValueParsed<Value extends ValueAny> =
  | DatatypeParsed<Value[PRIV]['datatype']>
  | (Value[PRIV]['nullable'] extends true ? null : never)
  | (Value[PRIV]['defaultValue'] extends null ? never : null);

export type ValuesParsed<Values extends ValuesAny> = {
  [K in keyof Values]: ValueParsed<Values[K]>;
};

type ValueInternal<
  Dt extends DatatypeAny,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase
> = {
  datatype: Dt;
  nullable: Nullable;
  defaultValue: DefaultValue;
  primary: boolean;
  unique: boolean;
};

export class Value<
  Dt extends DatatypeAny,
  Nullable extends boolean,
  DefaultValue extends DefaultValueBase
> {
  static create<Dt extends DatatypeAny>(datatype: Dt): Value<Dt, false, null> {
    return new Value({
      datatype,
      nullable: false,
      defaultValue: null,
      primary: false,
      unique: false,
    });
  }

  static json<T>(schema: zod.Schema<T>): Value<Datatype<'json', T>, false, null> {
    return Value.create(Datatype.json(schema));
  }

  static list<T>(schema: zod.Schema<T>): Value<Datatype<'jsonArray', T>, false, null> {
    return Value.create(Datatype.jsonArray(schema));
  }

  static text(schema: zod.Schema<string> | null = null): Value<Datatype<'text', any>, false, null> {
    return Value.create(Datatype.text(schema));
  }

  static number(
    schema: zod.Schema<number> | null = null
  ): Value<Datatype<'number', any>, false, null> {
    return Value.create(Datatype.number(schema));
  }

  static integer(
    schema: zod.Schema<number> | null = null
  ): Value<Datatype<'integer', any>, false, null> {
    return Value.create(Datatype.integer(schema));
  }

  static boolean(
    schema: zod.Schema<boolean> | null = null
  ): Value<Datatype<'boolean', any>, false, null> {
    return Value.create(Datatype.boolean(schema));
  }

  static date(): Value<Datatype<'date', any>, false, null> {
    return Value.create(Datatype.date());
  }

  static serialize<Value extends ValueAny>(value: Value, data: unknown, name: string): unknown {
    const val = value[PRIV];
    if (data === undefined || data === null) {
      if (val.defaultValue) {
        return Datatype.serialize(val.datatype, val.defaultValue());
      }
      if (val.nullable) {
        return null;
      }
      throw new Error(`Missing value ${name}.`);
    }
    return Datatype.serialize(val.datatype, data as any);
  }

  static parse<Value extends ValueAny>(
    value: Value,
    data: unknown,
    name: string
  ): ValueParsed<Value> {
    const val = value[PRIV];
    if (data === undefined || data === null) {
      if (val.defaultValue) {
        return val.defaultValue();
      }
      if (val.nullable) {
        return null as any;
      }
      throw new Error(`Value ${name} cannot be null/undefined.`);
    }
    return Datatype.parse(val.datatype, data as any) as any;
  }

  static serializeValues<Values extends ValuesAny>(
    values: Values,
    data: Record<string, any>
  ): Record<string, unknown> {
    return mapObject(values, (key, value) => {
      return Value.serialize(value, data[key], key);
    });
  }

  static parseValues<Values extends ValuesAny>(
    values: Values,
    data: Record<string, unknown>
  ): ValuesParsed<Values> {
    return mapObject(values, (key, value) => {
      return Value.parse(value, data[key], key);
    }) as any;
  }

  readonly [PRIV]: ValueInternal<Dt, Nullable, DefaultValue>;

  private constructor(internal: ValueInternal<Dt, Nullable, DefaultValue>) {
    this[PRIV] = internal;
  }

  nullable(): Value<Dt, true, DefaultValue> {
    return new Value({ ...this[PRIV], nullable: true });
  }

  defaultValue<DefaultValue extends DatatypeParsed<Dt>>(
    defaultValue: () => DefaultValue
  ): Value<Dt, Nullable, () => DefaultValue> {
    return new Value({ ...this[PRIV], defaultValue });
  }

  primary(): Value<Dt, Nullable, DefaultValue> {
    return new Value({ ...this[PRIV], primary: true });
  }

  unique(): Value<Dt, Nullable, DefaultValue> {
    return new Value({ ...this[PRIV], unique: true });
  }
}
