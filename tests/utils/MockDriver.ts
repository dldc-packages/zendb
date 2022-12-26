import { IDriver, IDriverDatabase, IDriverStatement } from '../../src/mod';

export class MockDiver implements IDriver<MockDriverDatabase> {
  public mainDatabase: MockDriverDatabase | null = null;
  public migrationDatabase: MockDriverDatabase | null = null;

  openMain(): MockDriverDatabase {
    if (this.mainDatabase) {
      throw new Error('main database already open');
    }
    this.mainDatabase = new MockDriverDatabase('main');
    return this.mainDatabase;
  }

  openMigration(): MockDriverDatabase {
    if (this.migrationDatabase) {
      throw new Error('migration database already open');
    }
    this.migrationDatabase = new MockDriverDatabase('migration');
    return this.migrationDatabase;
  }

  removeMain(): void {
    if (this.mainDatabase) {
      this.mainDatabase.close();
      this.mainDatabase = null;
    }
  }

  removeMigration(): void {
    if (this.migrationDatabase) {
      this.migrationDatabase.close();
      this.migrationDatabase = null;
    }
  }

  applyMigration(): void {
    if (!this.migrationDatabase) {
      throw new Error('migration database does not exist');
    }
    this.mainDatabase = this.migrationDatabase;
  }
}

export class MockDriverDatabase implements IDriverDatabase<MockDriverStatement> {
  constructor(public type: 'main' | 'migration') {}
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
