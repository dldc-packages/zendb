import { IDriver, IDriverDatabase, IDriverStatement } from '../../src/mod';

export class MockDiver implements IDriver<MockDriverDatabase> {
  databases: MockDriverDatabase[] = [];

  connect(path: string): MockDriverDatabase {
    const db = new MockDriverDatabase(path);
    this.databases.push(db);
    return db;
  }

  readonly remove = jest.fn((_path: string): void => {
    /* */
  });

  readonly rename = jest.fn((_oldPath: string, _newPath: string): void => {
    /* */
  });
}

export class MockDriverDatabase implements IDriverDatabase<MockDriverStatement> {
  constructor(public path: string) {}
  private nextStatements: MockDriverStatement[] = [];

  public statements: MockDriverStatement[] = [];
  public closed = false;

  public mockNextStatement(source: string) {
    const statement = new MockDriverStatement(source);
    this.nextStatements.push(statement);
    return statement;
  }

  readonly prepare = jest.fn((source: string): MockDriverStatement => {
    let statement = this.nextStatements.shift();
    if (!statement) {
      statement = new MockDriverStatement(source);
    }
    expect(source).toBe(statement.source);
    this.statements.push(statement);
    return statement;
  });

  readonly transaction = jest.fn((fn: () => void): void => {
    fn();
  });

  readonly exec = jest.fn((_source: string): this => {
    return this;
  });

  readonly close = jest.fn((): void => {
    this.closed = true;
  });

  readonly getUserVersion = jest.fn((): number => {
    throw new Error('Method not implemented.');
  });

  readonly setUserVersion = jest.fn((_version: number): void => {
    throw new Error('Method not implemented.');
  });
}

export class MockDriverStatement implements IDriverStatement {
  constructor(public source: string) {}

  readonly run = jest.fn((..._params: any[]): { changes: number } => {
    throw new Error('Method not implemented.');
  });

  readonly all = jest.fn((..._params: any[]): any[] => {
    throw new Error('Method not implemented.');
  });

  readonly bind = jest.fn((..._params: any[]): this => {
    // do nothing
    return this;
  });

  readonly free = jest.fn((): void => {
    // do nothing
    return;
  });
}
