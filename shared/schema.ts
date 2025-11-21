import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (required for Replit Auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  familyMemberships: many(familyMembers),
  wishlistItems: many(wishlistItems),
  purchases: many(itemPurchases),
}));

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Families table
export const families = pgTable("families", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  inviteCode: varchar("invite_code", { length: 50 }).notNull().unique(),
  createdById: varchar("created_by_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const familiesRelations = relations(families, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [families.createdById],
    references: [users.id],
  }),
  members: many(familyMembers),
}));

export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
});

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;

// Family members join table
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar("display_name", { length: 100 }), // Family-specific nickname
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
}));

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

// Wishlist items table
export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  url: text("url"),
  imageUrl: text("image_url"),
  source: varchar("source", { length: 100 }), // e.g., "manual" or "google_shopping"
  productId: varchar("product_id", { length: 255 }), // Google Shopping product ID if applicable
  priority: varchar("priority", { length: 20 }).default("medium"), // high, medium, low
  quantity: integer("quantity").default(1), // quantity desired
  category: varchar("category", { length: 50 }), // toys, clothes, electronics, books, home, other
  createdAt: timestamp("created_at").defaultNow(),
});

export const wishlistItemsRelations = relations(wishlistItems, ({ one, many }) => ({
  user: one(users, {
    fields: [wishlistItems.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [wishlistItems.familyId],
    references: [families.id],
  }),
  purchases: many(itemPurchases),
}));

export const insertWishlistItemSchema = createInsertSchema(wishlistItems).omit({
  id: true,
  createdAt: true,
});

export type InsertWishlistItem = z.infer<typeof insertWishlistItemSchema>;
export type WishlistItem = typeof wishlistItems.$inferSelect;

// Item purchases tracking table (for marking items as purchased with notes)
export const itemPurchases = pgTable("item_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull().references(() => wishlistItems.id, { onDelete: 'cascade' }),
  purchasedById: varchar("purchased_by_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  notes: text("notes"), // Private notes about the purchase
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

export const itemPurchasesRelations = relations(itemPurchases, ({ one }) => ({
  item: one(wishlistItems, {
    fields: [itemPurchases.itemId],
    references: [wishlistItems.id],
  }),
  purchasedBy: one(users, {
    fields: [itemPurchases.purchasedById],
    references: [users.id],
  }),
}));

export const insertItemPurchaseSchema = createInsertSchema(itemPurchases).omit({
  id: true,
  purchasedAt: true,
});

export type InsertItemPurchase = z.infer<typeof insertItemPurchaseSchema>;
export type ItemPurchase = typeof itemPurchases.$inferSelect;
