import { PRIV } from './Utils';
import { ValueParsed, Value, ValueAny, DatatypeAny } from './sql';

export type SchemaIndexFn<Data, T> = (data: Data) => T;

export type SchemaIndex<Name extends string, Data, Value extends ValueAny> = {
  _data: Data;
  _value: ValueParsed<Value>;
  name: Name;
  value: Value;
  fn: SchemaIndexFn<Data, ValueParsed<Value>>;
};

export type SchemaIndexAny = SchemaIndex<string, any, ValueAny>;

export type SchemaIndexesAny<Data> = ReadonlyArray<SchemaIndex<string, Data, ValueAny>>;

export type KeyValueBase = Value<DatatypeAny, false, null>;

export type SchemaTableAny = SchemaTable<any, KeyValueBase, SchemaIndexesAny<any>>;

export type SchemaTableInternalAny = SchemaTableInternal<any, KeyValueBase, SchemaIndexesAny<any>>;

export type SchemaTableInternal<
  Data,
  KeyValue extends KeyValueBase,
  Indexes extends SchemaIndexesAny<Data>
> = Readonly<{
  _data: Data;
  _keyType: ValueParsed<KeyValue>;
  keyValue: KeyValue;
  keyFn: SchemaIndexFn<Data, ValueParsed<KeyValue>>;
  indexes: Indexes;
}>;

export class SchemaTable<
  Data,
  KeyValue extends KeyValueBase,
  Indexes extends SchemaIndexesAny<Data>
> {
  static create<Data>() {
    return {
      key<KeyVal extends KeyValueBase>(
        keyValue: KeyVal,
        keyFn: SchemaIndexFn<Data, ValueParsed<KeyVal>>
      ) {
        return new SchemaTable<Data, KeyVal, []>({
          _data: null as any,
          _keyType: null as any,
          keyValue,
          keyFn,
          indexes: [],
        });
      },
    };
  }

  readonly [PRIV]: SchemaTableInternal<Data, KeyValue, Indexes>;

  private constructor(internal: SchemaTableInternal<Data, KeyValue, Indexes>) {
    this[PRIV] = internal;
  }

  index<Name extends string, Value extends ValueAny>(
    name: Name,
    value: Value,
    fn: SchemaIndexFn<Data, ValueParsed<Value>>
  ): SchemaTable<Data, KeyValue, [...Indexes, SchemaIndex<Name, Data, Value>]> {
    const { indexes } = this[PRIV];
    const currentIndexes = new Set(Array.from(indexes).map((idx) => idx.name));
    if (name === 'key') {
      throw new Error(`Index name 'key' is reserved`);
    }
    if (name === 'data') {
      throw new Error(`Index name 'data' is reserved`);
    }
    if (currentIndexes.has(name)) {
      throw new Error(`Duplicate index name '${name}'`);
    }
    const { datatype } = value[PRIV];
    if (datatype[PRIV].kind === 'json') {
      throw new Error('Invalid index type: json');
    }
    const index: SchemaIndex<Name, Data, Value> = {
      _data: null as any,
      _value: null as any,
      name,
      value,
      fn,
    };
    return new SchemaTable({
      ...this[PRIV],
      indexes: [...this[PRIV].indexes, index],
    });
  }
}
