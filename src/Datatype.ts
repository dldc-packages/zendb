import * as zod from 'zod';
import { expectNever } from './Utils';

export type DateValue = Date | number;

export type DatatypeJson<Value> = {
  kind: 'json';
  schema: zod.Schema<Value>;
};

export type DatatypeNumber = {
  kind: 'number';
  schema: null | zod.Schema<number>;
};

export type DatatypeInteger = {
  kind: 'integer';
  schema: null | zod.Schema<number>;
};

export type DatatypeText = {
  kind: 'text';
  schema: null | zod.Schema<string>;
};

export type DatatypeBoolean = {
  kind: 'boolean';
  schema: null | zod.Schema<boolean>;
};

// storing as seconds since 1970-01-01 (REAL)
export type DatatypeDate = {
  kind: 'date';
};

export type DatatypeMap = {
  number: DatatypeNumber;
  integer: DatatypeInteger;
  boolean: DatatypeBoolean;
  text: DatatypeText;
  date: DatatypeDate;
  json: DatatypeJson<unknown>;
};

export type DatatypeParsed<T extends Datatype> = T extends DatatypeJson<infer Value>
  ? Value
  : {
      number: number;
      integer: number;
      boolean: boolean;
      text: string;
      date: DateValue;
      json: never;
    }[T['kind']];

export type DatatypeSerialized<T extends Datatype> = {
  number: number;
  integer: number;
  boolean: number;
  text: string;
  date: number;
  json: string;
}[T['kind']];

export type Datatype = DatatypeMap[keyof DatatypeMap];

export const datatype = {
  json<Value>(schema: zod.Schema<Value>): DatatypeJson<Value> {
    return { kind: 'json', schema };
  },
  text(schema: zod.Schema<string> | null = null): DatatypeText {
    return { kind: 'text', schema };
  },
  number(schema: zod.Schema<number> | null = null): DatatypeNumber {
    return { kind: 'number', schema };
  },
  integer(schema: zod.Schema<number> | null = null): DatatypeInteger {
    return { kind: 'integer', schema };
  },
  boolean(schema: zod.Schema<boolean> | null = null): DatatypeBoolean {
    return { kind: 'boolean', schema };
  },
  date(): DatatypeDate {
    return { kind: 'date' };
  },
};

const datatypeTransform: {
  [K in keyof DatatypeMap]: {
    parse: (
      dt: DatatypeMap[K],
      val: DatatypeSerialized<DatatypeMap[K]>
    ) => DatatypeParsed<DatatypeMap[K]>;
    validate: (dt: DatatypeMap[K], val: unknown) => DatatypeParsed<DatatypeMap[K]>;
    serialize: (
      dt: DatatypeMap[K],
      val: DatatypeParsed<DatatypeMap[K]>
    ) => DatatypeSerialized<DatatypeMap[K]>;
  };
} = {
  integer: {
    parse: (_dt, val) => val as number,
    validate: (dt, val) => (dt.schema ?? zod.number().int()).parse(val),
    serialize: (_dt, val) => val,
  },
  number: {
    parse: (_dt, val) => val as number,
    validate: (dt, val) => (dt.schema ?? zod.number()).parse(val),
    serialize: (_dt, val) => val,
  },
  boolean: {
    parse: (_dt, val) => Boolean(val),
    validate: (dt, val) => (dt.schema ?? zod.boolean()).parse(val),
    serialize: (_dt, val) => (val ? 1 : 0),
  },
  text: {
    parse: (_dt, val) => val as string,
    validate: (dt, val) => (dt.schema ?? zod.string()).parse(val),
    serialize: (_dt, val) => val,
  },
  date: {
    parse: (_dt, val) => new Date(val as number),
    validate: (_dt, val) => {
      if (typeof val === 'number' || val instanceof Date) {
        return val;
      }
      throw new Error(`Invalid date valu: ${val}`);
    },
    serialize: (_dt, val) => {
      return typeof val === 'number' ? val : val.getTime() / 1000;
    },
  },
  json: {
    parse: (dt, val) => dt.schema.parse(JSON.parse(val)),
    validate: (dt, val) => dt.schema.parse(val),
    serialize: (_dt, val) => JSON.stringify(val),
  },
};

export function serializeDatatype<D extends Datatype>(dt: D, value: unknown): unknown {
  if (dt.kind === 'date') {
    return datatypeTransform.date.serialize(dt, datatypeTransform.date.validate(dt, value));
  }
  if (dt.kind === 'integer') {
    return datatypeTransform.integer.serialize(dt, datatypeTransform.integer.validate(dt, value));
  }
  if (dt.kind === 'boolean') {
    return datatypeTransform.boolean.serialize(dt, datatypeTransform.boolean.validate(dt, value));
  }
  if (dt.kind === 'number') {
    return datatypeTransform.number.serialize(dt, datatypeTransform.number.validate(dt, value));
  }
  if (dt.kind === 'json') {
    return datatypeTransform.json.serialize(dt, datatypeTransform.json.validate(dt, value));
  }
  if (dt.kind === 'text') {
    return datatypeTransform.text.serialize(dt, datatypeTransform.text.validate(dt, value));
  }
  return expectNever(dt);
}

export function parseDatatype<D extends Datatype>(dt: D, value: DatatypeSerialized<D>): unknown {
  if (dt.kind === 'date') {
    return datatypeTransform.date.parse(dt, value as any);
  }
  if (dt.kind === 'integer') {
    return datatypeTransform.integer.parse(dt, value as any);
  }
  if (dt.kind === 'boolean') {
    return datatypeTransform.boolean.parse(dt, value as any);
  }
  if (dt.kind === 'number') {
    return datatypeTransform.number.parse(dt, value as any);
  }
  if (dt.kind === 'json') {
    return datatypeTransform.json.parse(dt, value as any);
  }
  if (dt.kind === 'text') {
    return datatypeTransform.text.parse(dt, value as any);
  }
  return expectNever(dt);
}

export function printDatatype(datatype: Datatype): string {
  return {
    json: 'TEXT',
    text: 'TEXT',
    number: 'FLOAT',
    integer: 'INTEGER',
    date: 'FLOAT',
    boolean: 'INTEGER',
  }[datatype.kind];
}
