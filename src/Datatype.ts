import { TYPES } from './utils/constants';

export type SqliteDatatype = 'INTEGER' | 'TEXT' | 'REAL' | 'BLOB';

export type DatatypeAny = Datatype<any, any>;

export type Datatype<External, Internal = any> = {
  [TYPES]: External;
  name: string;
  parse: (value: Internal) => External;
  serialize: (value: External) => Internal;
  type: SqliteDatatype;
  isJson?: boolean;
};

export const Datatype = (() => {
  return {
    create: createDatatype,
    fromLiteral,
    // preset
    boolean: createDatatype<boolean, number>({
      name: 'boolean',
      parse: (value: number) => value === 1,
      serialize: (value: boolean) => (value ? 1 : 0),
      type: 'INTEGER',
    }),
    integer: createDatatype<number, number>({
      name: 'integer',
      parse: (value: number) => value,
      serialize: (value: number) => value,
      type: 'INTEGER',
    }),
    number: createDatatype<number, number>({
      name: 'number',
      parse: (value: number) => value,
      serialize: (value: number) => value,
      type: 'REAL',
    }),
    text: createDatatype<string, string>({
      name: 'text',
      parse: (value: string) => value,
      serialize: (value: string) => value,
      type: 'TEXT',
    }),
    date: createDatatype<Date, number>({
      name: 'date',
      parse: (value: number) => new Date(value),
      serialize: (value: Date) => value.getTime(),
      type: 'REAL',
    }),
    json: createDatatype<any, string>({
      name: 'json',
      parse: (value: string) => JSON.parse(value),
      serialize: (value: any) => JSON.stringify(value),
      type: 'TEXT',
      isJson: true,
    }),
    null: createDatatype<null, null>({
      name: 'null',
      parse: () => null,
      serialize: () => null,
      type: 'TEXT',
    }),
    any: createDatatype<any, any>({
      name: 'any',
      parse: (value: any) => value,
      serialize: (value: any) => value,
      type: 'TEXT',
    }),
  };

  function fromLiteral<Val extends string | number | boolean | null>(val: Val): Datatype<Val> {
    if (val === null) return Datatype.null as any;
    if (typeof val === 'string') return Datatype.text as any;
    if (typeof val === 'number') return Datatype.number as any;
    if (typeof val === 'boolean') return Datatype.boolean as any;
    throw new Error('Invalid literal');
  }

  function createDatatype<External, Internal>(
    dt: Omit<Datatype<External, Internal>, TYPES>
  ): Datatype<External, Internal> {
    return dt as any;
  }
})();
