import * as zen from '../../src/mod';

export const tasksSchema = zen.schema({
  tables: {
    tasks: zen.table({
      id: zen.column.text().primary(),
      title: zen.column.text(),
      description: zen.column.text(),
      completed: zen.column.boolean(),
    }),
    users: zen.table({
      id: zen.column.text().primary(),
      name: zen.column.text(),
      email: zen.column.text(),
    }),
    users_tasks: zen.table({
      user_id: zen.column.text().primary(),
      task_id: zen.column.text().primary(),
    }),
  },
});
