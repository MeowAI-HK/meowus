import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.SOCIAL_AUTO_POST_DB_URL ?? "file:./web-data/social-auto-post.db",
  },
});
