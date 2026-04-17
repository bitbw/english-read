import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  primaryKey,
  index,
  uniqueIndex,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────
// Auth.js v5 Required Tables
// ─────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  /** 邮箱密码注册用户；OAuth 用户为 null */
  passwordHash: text("password_hash"),
  /** IANA 时区，可空：空则使用请求头 `X-User-Timezone`，再否则 UTC */
  timeZone: text("time_zone"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("accounts_user_id_idx").on(account.userId),
  })
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("sessions_user_id_idx").on(session.userId),
  })
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─────────────────────────────────────────────
// Public library（公共书库，全员可见）
// ─────────────────────────────────────────────

export const publicLibraryBooks = pgTable(
  "public_library_books",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    author: text("author"),
    coverUrl: text("cover_url"),
    blobUrl: text("blob_url").notNull(),
    blobKey: text("blob_key").notNull(),
    fileSize: integer("file_size"),
    /** 1k | 2k | 3k | 4k | 5k — 与 reading-tiers 一致 */
    tier: text("tier").notNull(),
    tierSource: text("tier_source", { enum: ["llm", "fallback"] }).notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    tierIdx: index("public_library_books_tier_idx").on(t.tier),
    uploadedByIdx: index("public_library_books_uploaded_by_idx").on(t.uploadedBy),
    createdIdx: index("public_library_books_created_idx").on(t.createdAt),
  })
);

// ─────────────────────────────────────────────
// Books（个人书架）
// ─────────────────────────────────────────────

export const books = pgTable(
  "books",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    author: text("author"),
    coverUrl: text("cover_url"),
    blobUrl: text("blob_url").notNull(),
    blobKey: text("blob_key").notNull(),
    fileSize: integer("file_size"),
    totalChapters: integer("total_chapters"),
    currentCfi: text("current_cfi"),
    readingProgress: integer("reading_progress").default(0),
    lastReadAt: timestamp("last_read_at", { mode: "date" }),
    /** 从公共书库加入时指向公共条目，用于去重 */
    publicBookId: text("public_book_id").references(() => publicLibraryBooks.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (book) => ({
    userIdIdx: index("books_user_id_idx").on(book.userId),
    userCreatedIdx: index("books_user_created_idx").on(book.userId, book.createdAt),
    publicBookIdIdx: index("books_public_book_id_idx").on(book.publicBookId),
    userPublicBookUnique: uniqueIndex("books_user_public_book_unique").on(
      book.userId,
      book.publicBookId
    ),
  })
);

// ─────────────────────────────────────────────
// Reading daily time（每日阅读时长，秒）
// ─────────────────────────────────────────────

export const readingDailyTime = pgTable(
  "reading_daily_time",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    seconds: integer("seconds").default(0).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.day] }),
    userDayIdx: index("reading_daily_time_user_day_idx").on(t.userId, t.day),
  })
);

// ─────────────────────────────────────────────
// Vocabulary（生词本）
// ─────────────────────────────────────────────

export const vocabulary = pgTable(
  "vocabulary",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bookId: text("book_id").references(() => books.id, { onDelete: "set null" }),
    word: text("word").notNull(),
    normalizedWord: text("normalized_word").notNull(),
    context: text("context"),
    contextCfi: text("context_cfi"),
    definition: text("definition"),
    phonetic: text("phonetic"),
    /** Free Dictionary CDN mp3，可能为空 */
    audioUk: text("audio_uk"),
    audioUs: text("audio_us"),
    note: text("note"),
    // 0=新词, 1-5=复习中, 6=已掌握
    reviewStage: integer("review_stage").default(0).notNull(),
    nextReviewAt: timestamp("next_review_at", { mode: "date" }).notNull(),
    masteredAt: timestamp("mastered_at", { mode: "date" }),
    isMastered: boolean("is_mastered").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (vocab) => ({
    userIdIdx: index("vocabulary_user_id_idx").on(vocab.userId),
    userWordUnique: uniqueIndex("vocabulary_user_word_unique").on(
      vocab.userId,
      vocab.normalizedWord
    ),
    nextReviewIdx: index("vocabulary_next_review_idx").on(
      vocab.userId,
      vocab.nextReviewAt,
      vocab.isMastered
    ),
    bookIdIdx: index("vocabulary_book_id_idx").on(vocab.bookId),
  })
);

// ─────────────────────────────────────────────
// Review Logs（复习记录）
// ─────────────────────────────────────────────

export const reviewLogs = pgTable(
  "review_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vocabularyId: text("vocabulary_id")
      .notNull()
      .references(() => vocabulary.id, { onDelete: "cascade" }),
    stageBeforeReview: integer("stage_before_review").notNull(),
    result: text("result", { enum: ["remembered", "forgotten"] }).notNull(),
    stageAfterReview: integer("stage_after_review").notNull(),
    nextReviewAt: timestamp("next_review_at", { mode: "date" }).notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date" }).defaultNow().notNull(),
  },
  (log) => ({
    userIdIdx: index("review_logs_user_id_idx").on(log.userId),
    vocabularyIdIdx: index("review_logs_vocabulary_id_idx").on(log.vocabularyId),
    userReviewedIdx: index("review_logs_user_reviewed_idx").on(log.userId, log.reviewedAt),
  })
);

// ─────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  books: many(books),
  publicLibraryBooks: many(publicLibraryBooks),
  vocabulary: many(vocabulary),
  reviewLogs: many(reviewLogs),
  readingDailyTime: many(readingDailyTime),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const publicLibraryBooksRelations = relations(publicLibraryBooks, ({ one, many }) => ({
  uploader: one(users, { fields: [publicLibraryBooks.uploadedBy], references: [users.id] }),
  shelfCopies: many(books),
}));

export const booksRelations = relations(books, ({ one, many }) => ({
  user: one(users, { fields: [books.userId], references: [users.id] }),
  publicBook: one(publicLibraryBooks, {
    fields: [books.publicBookId],
    references: [publicLibraryBooks.id],
  }),
  vocabulary: many(vocabulary),
}));

export const vocabularyRelations = relations(vocabulary, ({ one, many }) => ({
  user: one(users, { fields: [vocabulary.userId], references: [users.id] }),
  book: one(books, { fields: [vocabulary.bookId], references: [books.id] }),
  reviewLogs: many(reviewLogs),
}));

export const reviewLogsRelations = relations(reviewLogs, ({ one }) => ({
  user: one(users, { fields: [reviewLogs.userId], references: [users.id] }),
  vocabulary: one(vocabulary, {
    fields: [reviewLogs.vocabularyId],
    references: [vocabulary.id],
  }),
}));

export const readingDailyTimeRelations = relations(readingDailyTime, ({ one }) => ({
  user: one(users, { fields: [readingDailyTime.userId], references: [users.id] }),
}));
