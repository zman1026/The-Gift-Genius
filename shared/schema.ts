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

// Managed profiles table (for children/dependents without their own accounts)
export const managedProfiles = pgTable("managed_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  createdById: varchar("created_by_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // Parent/guardian
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const managedProfilesRelations = relations(managedProfiles, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [managedProfiles.createdById],
    references: [users.id],
  }),
  familyMemberships: many(familyMembers),
  wishlistItems: many(wishlistItems),
}));

export const insertManagedProfileSchema = createInsertSchema(managedProfiles).omit({
  id: true,
  createdAt: true,
});

export type InsertManagedProfile = z.infer<typeof insertManagedProfileSchema>;
export type ManagedProfile = typeof managedProfiles.$inferSelect;

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

// Family members join table (supports both real users and managed profiles)
export const familyMembers = pgTable("family_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // Nullable - either userId OR managedProfileId
  managedProfileId: varchar("managed_profile_id").references(() => managedProfiles.id, { onDelete: 'cascade' }), // Nullable - for children/dependents
  displayName: varchar("display_name", { length: 100 }), // Family-specific nickname
  giftBudget: decimal("gift_budget", { precision: 10, scale: 2 }), // Personal gift-buying budget for this family
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("idx_family_members_user_lookup").on(table.userId, table.familyId),
  index("idx_family_members_family_lookup").on(table.familyId, table.userId),
  index("idx_family_members_managed_lookup").on(table.managedProfileId, table.familyId),
]);

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
  managedProfile: one(managedProfiles, {
    fields: [familyMembers.managedProfileId],
    references: [managedProfiles.id],
  }),
}));

export const insertFamilyMemberSchema = createInsertSchema(familyMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertFamilyMember = z.infer<typeof insertFamilyMemberSchema>;
export type FamilyMember = typeof familyMembers.$inferSelect;

// Wishlist items table (supports both real users and managed profiles)
export const wishlistItems = pgTable("wishlist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // Nullable - either userId OR managedProfileId
  managedProfileId: varchar("managed_profile_id").references(() => managedProfiles.id, { onDelete: 'cascade' }), // Nullable - for children/dependents
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
  itemType: varchar("item_type", { length: 20 }).default("product"), // product, experience, service, membership, other
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_wishlist_items_lookup").on(table.familyId, table.userId, table.priority),
  index("idx_wishlist_items_managed_lookup").on(table.familyId, table.managedProfileId, table.priority),
]);

export const wishlistItemsRelations = relations(wishlistItems, ({ one, many }) => ({
  user: one(users, {
    fields: [wishlistItems.userId],
    references: [users.id],
  }),
  managedProfile: one(managedProfiles, {
    fields: [wishlistItems.managedProfileId],
    references: [managedProfiles.id],
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

// Activity logs table
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  actorId: varchar("actor_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: 'cascade' }), // Optional: user affected by action
  itemId: varchar("item_id").references(() => wishlistItems.id, { onDelete: 'cascade' }), // Optional: related wishlist item
  action: varchar("action", { length: 50 }).notNull(), // item_added, item_purchased, item_deleted, member_joined, etc.
  metadata: jsonb("metadata"), // Additional data (e.g., item name, price, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_activity_logs_family_created").on(table.familyId, table.createdAt),
]);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  family: one(families, {
    fields: [activityLogs.familyId],
    references: [families.id],
  }),
  actor: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
  targetUser: one(users, {
    fields: [activityLogs.targetUserId],
    references: [users.id],
  }),
  item: one(wishlistItems, {
    fields: [activityLogs.itemId],
    references: [wishlistItems.id],
  }),
}));

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

// Bulk action schemas
export const bulkDeleteItemsSchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item ID is required").max(50, "Cannot delete more than 50 items at once"),
  familyId: z.string().min(1, "Family ID is required"),
});

export type BulkDeleteItems = z.infer<typeof bulkDeleteItemsSchema>;

export const bulkUpdatePrioritySchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item ID is required").max(50, "Cannot update more than 50 items at once"),
  priority: z.enum(["low", "medium", "high"]),
  familyId: z.string().min(1, "Family ID is required"),
});

export type BulkUpdatePriority = z.infer<typeof bulkUpdatePrioritySchema>;
