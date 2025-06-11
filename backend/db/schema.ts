import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(), // users 테이블은 그대로 serial 유지
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumesTable = pgTable('resumes', {
  id: text('id').primaryKey(), // UUID를 저장하기 위해 text 타입으로 변경
  userId: integer('user_id').references(() => usersTable.id),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  originalContent: text('original_content'),
  generatedMarkdown: text('generated_markdown'),
  status: varchar('status', { length: 50 }).default('initiated'), // 작업 상태 추적용 컬럼 추가
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
