import { Traverser, TraverserResult, traverserToIterable } from './Utils';

export type Entry<Key, Data> = [Key, Data];
export type EntryObj<Key, Data> = { key: Key; data: Data };

export type PipeParent<Key> = {
  deleteByKey: (key: Key) => void;
  // returns updated key because it may be changed
  updateByKey: (key: Key, data: unknown) => { updatedKey: Key };
  insert: (data: unknown) => { newKey: Key };
};

export class PipeSingleReadonly<Key, Data, Maybe extends boolean> {
  protected readonly parent: PipeParent<Key>;
  protected readonly internal: null | EntryObj<Key, Data>;

  constructor(entry: null | EntryObj<Key, Data>, parent: PipeParent<Key>) {
    this.internal = entry;
    this.parent = parent;
  }

  transform<Out>(transform: (item: Data) => Out): PipeSingleReadonly<Key, Out, Maybe> {
    if (this.internal === null) {
      return this as any;
    }
    return new PipeSingleReadonly<Key, Out, Maybe>(
      {
        key: this.internal.key,
        data: transform(this.internal.data),
      },
      this.parent
    );
  }

  filter(filter: (val: Data) => boolean): PipeSingle<Key, Data, true> {
    if (this.internal === null) {
      return this as any;
    }
    if (filter(this.internal.data)) {
      return this as any;
    }
    return new PipeSingle<Key, Data, true>(null, this.parent);
  }

  value(): Maybe extends true ? Data | null : Data {
    return (this.internal?.data ?? null) as any;
  }

  key(): Maybe extends true ? Key | null : Key {
    return (this.internal?.key ?? null) as any;
  }

  entry(): Maybe extends true ? Entry<Key, Data> | null : Entry<Key, Data> {
    return this.internal as any;
  }
}

export class PipeSingle<Key, Data, Maybe extends boolean> extends PipeSingleReadonly<
  Key,
  Data,
  Maybe
> {
  delete(): PipeSingleReadonly<Key, Data, Maybe> {
    /**
     * We could put delete() in PipeSingleReadonly and allow transform().delete()
     * but we don't want delete().update() to be possible
     * This is probably fine because you can delete().transform() which produce the same result
     */
    if (this.internal !== null) {
      this.parent.deleteByKey(this.internal.key);
    }
    return new PipeSingleReadonly<Key, Data, Maybe>(this.internal, this.parent);
  }

  /**
   * Throw if the entry does not exists
   */
  update(update: Data | ((item: Data) => Data)): PipeSingle<Key, Data, Maybe> {
    if (this.internal === null) {
      throw new Error('Cannot update a non-existing entry');
    }
    const updated = typeof update === 'function' ? (update as any)(this.internal.data) : update;
    if (updated === this.internal.data) {
      return this as any;
    }
    const { updatedKey } = this.parent.updateByKey(this.internal.key, updated);
    return new PipeSingle<Key, Data, Maybe>({ key: updatedKey, data: updated }, this.parent);
  }

  updateIfExists(update: Data | ((item: Data) => Data)): PipeSingle<Key, Data, Maybe> {
    if (this.internal === null) {
      return this as any;
    }
    return this.update(update);
  }

  /**
   * Update the entry if it exists, otherwise create a new entry
   */
  upsert(data: Data | ((item: Data | null) => Data)): PipeSingle<Key, Data, false> {
    if (this.internal !== null) {
      return this.update(data as any) as any;
    }
    // insert
    const dataResolved = typeof data === 'function' ? (data as any)(null) : data;
    const { newKey } = this.parent.insert(dataResolved);
    return new PipeSingle<Key, Data, false>({ key: newKey, data: dataResolved }, this.parent);
  }
}

export class PipeCollectionReadonly<Key, Data> {
  protected readonly parent: PipeParent<Key>;
  protected readonly traverser: Traverser<Key, Data>;

  constructor(traverser: Traverser<Key, Data>, parent: PipeParent<Key>) {
    this.traverser = traverser;
    this.parent = parent;
  }

  /**
   * Get all data then re-emit them
   */
  cache(): PipeCollection<Key, Data> {
    const all = this.entriesArray();
    return new PipeCollection<Key, Data>((): TraverserResult<Key, Data> => {
      if (all.length === 0) {
        return null;
      }
      return all.shift() as any;
    }, this.parent);
  }

  /**
   * Get all data then re-emit them
   */
  cacheReadonly(): PipeCollectionReadonly<Key, Data> {
    const all = this.entriesArray();
    return new PipeCollectionReadonly<Key, Data>((): TraverserResult<Key, Data> => {
      if (all.length === 0) {
        return null;
      }
      return all.shift() as any;
    }, this.parent);
  }

  filter(fn: (val: Data) => boolean): PipeCollection<Key, Data> {
    let done = false;
    return new PipeCollection<Key, Data>((): TraverserResult<Key, Data> => {
      if (done) {
        return null;
      }
      let next = this.traverser();
      while (next !== null && fn(next.data) === false) {
        next = this.traverser();
      }
      if (next === null) {
        done = true;
        return null;
      }
      return next;
    }, this.parent);
  }

  transform<Out>(fn: (item: Data) => Out): PipeCollection<Key, Out> {
    let done = false;
    return new PipeCollection<Key, Out>((): TraverserResult<Key, Out> => {
      if (done) {
        return null;
      }
      const next = this.traverser();
      if (next === null) {
        done = true;
        return null;
      }
      return { key: next.key, data: fn(next.data) };
    }, this.parent);
  }

  // throw if more count is not one
  one(): PipeSingle<Key, Data, false> {
    const first = this.traverser();
    if (first === null) {
      throw new Error(`.one() expected one, received none`);
    }
    const second = this.traverser();
    if (second !== null) {
      throw new Error(`.one() expected one, received more`);
    }
    return new PipeSingle<Key, Data, false>(first, this.parent);
  }

  // throw if count > 1
  maybeOne(): PipeSingle<Key, Data, true> {
    const first = this.traverser();
    if (first === null) {
      return new PipeSingle<Key, Data, true>(null, this.parent);
    }
    const second = this.traverser();
    if (second !== null) {
      throw new Error(`.maybeOne() expected one, received more`);
    }
    return new PipeSingle<Key, Data, true>(first, this.parent);
  }

  // throw if count < 1
  first(): PipeSingle<Key, Data, false> {
    const first = this.traverser();
    if (first === null) {
      throw new Error(`.first() expected at least one, received none`);
    }
    return new PipeSingle<Key, Data, false>(first, this.parent);
  }

  // never throw
  maybeFirst(): PipeSingle<Key, Data, true> {
    const first = this.traverser();
    if (first === null) {
      return new PipeSingle<Key, Data, true>(null, this.parent);
    }
    return new PipeSingle<Key, Data, true>(first, this.parent);
  }

  valuesArray(): Array<Data> {
    return Array.from(this.values());
  }

  values(): Iterable<Data> {
    return traverserToIterable(this.traverser, (_key, value) => value);
  }

  entriesArray(): Array<Entry<Key, Data>> {
    return Array.from(this.entries());
  }

  entries(): Iterable<Entry<Key, Data>> {
    return traverserToIterable(this.traverser, (key, value) => [key, value]);
  }

  keysArray(): Array<Key> {
    return Array.from(this.keys());
  }

  keys(): Iterable<Key> {
    return traverserToIterable(this.traverser, (key) => key);
  }

  /**
   * Traverse all items (apply update / delete)
   */
  apply(): void {
    let next = this.traverser();
    while (next !== null) {
      next = this.traverser();
    }
  }
}

export class PipeCollection<Key, Data> extends PipeCollectionReadonly<Key, Data> {
  update(fn: (item: Data) => Data): PipeCollection<Key, Data> {
    let done = false;
    return new PipeCollection<Key, Data>((): TraverserResult<Key, Data> => {
      if (done) {
        return null;
      }
      const next = this.traverser();
      if (next === null) {
        done = true;
        return null;
      }
      const updated = fn(next.data);
      if (updated === next.data) {
        return next;
      }
      const { updatedKey } = this.parent.updateByKey(next.key, updated);
      return { key: updatedKey, data: updated };
    }, this.parent);
  }

  updateAll(fn: (item: Data) => Data): PipeCollection<Key, Data> {
    return this.update(fn).cache();
  }

  delete(): PipeCollectionReadonly<Key, Data> {
    let done = false;
    return new PipeCollectionReadonly<Key, Data>((): TraverserResult<Key, Data> => {
      if (done) {
        return null;
      }
      const next = this.traverser();
      if (next === null) {
        done = true;
        return null;
      }
      this.parent.deleteByKey(next.key);
      return next;
    }, this.parent);
  }

  deleteAll(): PipeCollectionReadonly<Key, Data> {
    return this.delete().cacheReadonly();
  }
}
