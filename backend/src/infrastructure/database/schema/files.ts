import { pgTable, uuid, varchar, timestamp, bigint, text, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

export const uploadedFiles = pgTable('uploaded_files', {
  id: uuid('id').primaryKey().default(uuid7),
  uploaderId: uuid('uploader_id').notNull().references(() => users.id),
  originalName: varchar('original_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  checksum: varchar('checksum', { length: 64 }),
  storagePath: varchar('storage_path', { length: 500 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  cdnUrl: varchar('cdn_url', { length: 500 }),
  status: varchar('status', { length: 20 }).default('READY'),
  contextType: varchar('context_type', { length: 50 }),
  contextId: uuid('context_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uploaderIdx: index('idx_files_uploader').on(table.uploaderId, table.createdAt.desc()),
  checksumIdx: index('idx_files_checksum').on(table.checksum),
}));