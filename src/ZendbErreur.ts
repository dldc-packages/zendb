import type { TKey } from '@dldc/erreur';
import { Erreur, Key } from '@dldc/erreur';

export type TZendbErreurData =
  | { kind: 'InvalidLiteral'; value: unknown }
  | { kind: 'MissingPrimaryKey'; table: string }
  | { kind: 'InvalidUniqueConstraint'; constraintName: string | null }
  | { kind: 'NoRows' }
  | { kind: 'ColumnNotFound'; columnKey: string }
  | { kind: 'ColumnDoesNotExist'; column: string }
  | { kind: 'CannotInsertEmptyArray'; table: string };

export const ZendbErreurKey: TKey<TZendbErreurData, false> = Key.create<TZendbErreurData>('ZendbErreur');

export const ZendbErreur = {
  InvalidLiteral: (value: unknown) => {
    return Erreur.create(new Error(`Invalid literal ${String(value)}`))
      .with(ZendbErreurKey.Provider({ kind: 'InvalidLiteral', value }))
      .withName('ZendbErreur');
  },
  MissingPrimaryKey: (table: string) => {
    return Erreur.create(new Error(`No primary key found for table ${table}`))
      .with(ZendbErreurKey.Provider({ kind: 'MissingPrimaryKey', table }))
      .withName('ZendbErreur');
  },
  InvalidUniqueConstraint: (constraintName: string | null) => {
    return Erreur.create(new Error(`Invalid unique constraint ${constraintName}`))
      .with(ZendbErreurKey.Provider({ kind: 'InvalidUniqueConstraint', constraintName }))
      .withName('ZendbErreur');
  },
  NoRows: () => {
    return Erreur.create(new Error('Expected one row, got 0'))
      .with(ZendbErreurKey.Provider({ kind: 'NoRows' }))
      .withName('ZendbErreur');
  },
  ColumnNotFound: (columnKey: string) => {
    return Erreur.create(new Error(`Column not found: ${columnKey}`))
      .with(ZendbErreurKey.Provider({ kind: 'ColumnNotFound', columnKey }))
      .withName('ZendbErreur');
  },
  ColumnDoesNotExist: (column: string) => {
    return Erreur.create(new Error(`Column "${column}" does not exist`))
      .with(ZendbErreurKey.Provider({ kind: 'ColumnDoesNotExist', column }))
      .withName('ZendbErreur');
  },
  CannotInsertEmptyArray: (table: string) => {
    return Erreur.create(new Error(`No data to insert into table ${table}`))
      .with(ZendbErreurKey.Provider({ kind: 'CannotInsertEmptyArray', table }))
      .withName('ZendbErreur');
  },
};
