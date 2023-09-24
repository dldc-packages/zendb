import type { IKey } from '@dldc/erreur';
import { Erreur, Key } from '@dldc/erreur';

const ZendbErrorKey: IKey<undefined, false, []> = Key.createEmpty('ZendbError');
const InvalidLiteralKey: IKey<{ value: unknown }, false> = Key.create('InvalidLiteral');
const MissingPrimaryKeyKey: IKey<{ table: string }, false> = Key.create('MissingPrimaryKey');
const InvalidUniqueConstraintKey: IKey<{ constraintName: string | null }, false> =
  Key.create('InvalidUniqueConstraint');
const NoRowsKey: IKey<undefined, false, []> = Key.createEmpty('NoRows');
const ColumnNotFoundKey: IKey<{ columnKey: string }, false> = Key.create('ColumnNotFound');
const ColumnDoesNotExistKey: IKey<{ column: string }, false> = Key.create('ColumnDoesNotExist');

export const ZendbError = {
  Key: ZendbErrorKey,
  create: createZendbError,
  InvalidLiteral: {
    Key: InvalidLiteralKey,
    create: createInvalidLiteral,
  },
  MissingPrimaryKey: {
    Key: MissingPrimaryKeyKey,
    create: createMissingPrimaryKey,
  },
  InvalidUniqueConstraint: {
    Key: InvalidUniqueConstraintKey,
    create: createInvalidUniqueConstraint,
  },
  NoRows: {
    Key: NoRowsKey,
    create: createNoRows,
  },
  ColumnNotFound: {
    Key: ColumnNotFoundKey,
    create: createColumnNotFound,
  },
  ColumnDoesNotExist: {
    Key: ColumnDoesNotExistKey,
    create: createColumnDoesNotExist,
  },
};

function createZendbError() {
  return Erreur.createWith(ZendbErrorKey).withName('ZendbError');
}

function createInvalidLiteral(value: unknown) {
  return createZendbError()
    .with(InvalidLiteralKey.Provider({ value }))
    .withMessage(`Invalid literal ${String(value)}`);
}

function createMissingPrimaryKey(table: string) {
  return createZendbError()
    .with(MissingPrimaryKeyKey.Provider({ table }))
    .withMessage(`No primary key found for table ${table}`);
}

function createInvalidUniqueConstraint(constraintName: string | null) {
  return createZendbError()
    .with(InvalidUniqueConstraintKey.Provider({ constraintName }))
    .withMessage(`Invalid unique constraint ${constraintName}`);
}

function createNoRows() {
  return createZendbError().with(NoRowsKey.Provider()).withMessage('Expected one row, got 0');
}

function createColumnNotFound(columnKey: string) {
  return createZendbError()
    .with(ColumnNotFoundKey.Provider({ columnKey }))
    .withMessage(`Column not found: ${columnKey}`);
}

function createColumnDoesNotExist(column: string) {
  return createZendbError()
    .with(ColumnDoesNotExistKey.Provider({ column }))
    .withMessage(`Column "${column}" does not exist`);
}
