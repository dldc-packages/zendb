import * as zen from '../../src';

export type RepeatMode = 'daily' | 'weekly' | 'monthly';

export type Priority = 'low' | 'medium' | 'high';

export type Repeat = {
  mode: RepeatMode;
  reassign: boolean;
};

const users = zen.table({
  email: zen.column.text().primary(),
  token: zen.column.text(),
  name: zen.column.text(),
});

export type User = zen.Infer<typeof users>;

const spaces = zen.table({
  id: zen.column.text().primary(),
  slug: zen.column.text().unique(),
  name: zen.column.text(),
});

export type Space = zen.Infer<typeof spaces>;

const user_space = zen.table({
  userEmail: zen.column.text().primary(),
  spaceId: zen.column.text().primary(),
});

export type UserSpace = zen.Infer<typeof user_space>;

const customDt = zen.Datatype.create<bigint, string>({
  name: 'bigint',
  parse: (value: string) => BigInt(value),
  serialize: (value: bigint) => value.toString(),
  type: 'INTEGER',
});

const tasks = zen.table({
  id: zen.column.text().primary(),
  spaceId: zen.column.text(),
  chainId: zen.column.text(),
  name: zen.column.text(),
  infos: zen.column.text(),
  color: zen.column.text(),
  createdAt: zen.column.date().defaultValue(() => new Date()),
  date: zen.column.date(),
  priority: zen.column.text<Priority>(),
  repeat: zen.column.json<Repeat>().nullable(),
  done: zen.column.boolean().defaultValue(() => false),
  big: zen.column.create(customDt).nullable(),
});

export type Task = zen.Infer<typeof tasks>;

const task_user = zen.table({
  taskId: zen.column.text().primary(),
  userEmail: zen.column.text().primary(),
});

export type TaskUser = zen.Infer<typeof task_user>;

export const schema = zen.schema({
  tables: { users, spaces, tasks, user_space, task_user },
  strict: false,
});
