import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql', schema: ['./server/db/schema.ts', './server/db/ritual-schema.ts'], out: './drizzle',
  ...(process.env.DATABASE_URL_UNPOOLED ? { dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED } } : {}),
  strict: true,
});
