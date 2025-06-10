import { pgTable, serial, text, timestamp, varchar, integer } from 'drizzle-orm/pg-core';

export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumesTable = pgTable('resumes', {
  id: serial('id').primaryKey(),
  // userId를 nullable로 변경하고, serial 대신 integer 사용 (FK이므로)
  // usersTable.id가 serial (integer + auto-increment)이므로, 여기서는 integer로 참조
  userId: integer('user_id').references(() => usersTable.id),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  originalContent: text('original_content'), // Uploaded file content (text extracted)
  generatedMarkdown: text('generated_markdown'), // AI generated markdown
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
