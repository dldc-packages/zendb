import { PRIV } from '../../Utils';
import { Column } from './Column';

type JsonTableInternal = Readonly<{
  mode: 'Tree' | 'Each';
  sourceColumn: Column;
  path: string | null;
  alias: null | { original: JsonTable; alias: string };
}>;

type JsonTableColumns = {
  key: Column; // ANY, -- key for current element relative to its parent
  value: Column; // ANY, -- value for the current element
  type: Column; // TEXT, -- 'object','array','string','integer', etc.
  atom: Column; // ANY, -- value for primitive types, null for array & object
  id: Column; // INTEGER, -- integer ID for this element
  parent: Column; // INTEGER, -- integer ID for the parent of this element
  fullkey: Column; // TEXT, -- full path describing the current element
  path: Column; // TEXT, -- path to the container of the current row
  json: Column; // JSON HIDDEN, -- 1st input parameter: the raw JSON
  root: Column; // TEXT HIDDEN -- 2nd input parameter: the PATH at which to start
};

export class JsonTable {
  static tree(column: Column, path: string | null = null): JsonTable {
    return new JsonTable({ mode: 'Tree', sourceColumn: column, alias: null, path });
  }

  static each(column: Column, path: string | null = null): JsonTable {
    return new JsonTable({ mode: 'Each', sourceColumn: column, alias: null, path });
  }

  readonly [PRIV]: JsonTableInternal;

  public readonly columns: JsonTableColumns;

  private constructor(internal: JsonTableInternal) {
    this[PRIV] = internal;
    this.columns = {
      key: Column.create(this, 'key'),
      value: Column.create(this, 'value'),
      type: Column.create(this, 'type'),
      atom: Column.create(this, 'atom'),
      id: Column.create(this, 'id'),
      parent: Column.create(this, 'parent'),
      fullkey: Column.create(this, 'fullkey'),
      path: Column.create(this, 'path'),
      json: Column.create(this, 'json'),
      root: Column.create(this, 'root'),
    };
  }

  public as(alias: string): JsonTable {
    return new JsonTable({
      ...this[PRIV],
      alias: { alias, original: this },
    });
  }
}
