import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
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
  personalLists: many(personalLists),
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
  guardians: many(managedProfileGuardians),
  familyMemberships: many(familyMembers),
  wishlistItems: many(wishlistItems),
}));

export const insertManagedProfileSchema = createInsertSchema(managedProfiles).omit({
  id: true,
  createdAt: true,
});

export type InsertManagedProfile = z.infer<typeof insertManagedProfileSchema>;
export type ManagedProfile = typeof managedProfiles.$inferSelect;

// Managed profile guardians junction table (for multi-parent support)
export const managedProfileGuardians = pgTable("managed_profile_guardians", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  managedProfileId: varchar("managed_profile_id").notNull().references(() => managedProfiles.id, { onDelete: 'cascade' }),
  guardianUserId: varchar("guardian_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  isPrimary: boolean("is_primary").default(false), // Primary guardian (original creator)
  canEdit: boolean("can_edit").default(true), // Can edit profile and wishlist
  canManageBudget: boolean("can_manage_budget").default(false), // Can manage budget allocations
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  index("idx_managed_profile_guardians_profile").on(table.managedProfileId),
  index("idx_managed_profile_guardians_user").on(table.guardianUserId),
  unique("unique_profile_guardian").on(table.managedProfileId, table.guardianUserId),
]);

export const managedProfileGuardiansRelations = relations(managedProfileGuardians, ({ one }) => ({
  managedProfile: one(managedProfiles, {
    fields: [managedProfileGuardians.managedProfileId],
    references: [managedProfiles.id],
  }),
  guardian: one(users, {
    fields: [managedProfileGuardians.guardianUserId],
    references: [users.id],
  }),
}));

export const insertManagedProfileGuardianSchema = createInsertSchema(managedProfileGuardians).omit({
  id: true,
  addedAt: true,
});

export type InsertManagedProfileGuardian = z.infer<typeof insertManagedProfileGuardianSchema>;
export type ManagedProfileGuardian = typeof managedProfileGuardians.$inferSelect;

// Families table (Groups)
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
  wishlistItems: many(wishlistItems),
  activityLogs: many(activityLogs),
  budgetAllocations: many(budgetAllocations),
}));

export const insertFamilySchema = createInsertSchema(families).omit({
  id: true,
  createdAt: true,
});

export type InsertFamily = z.infer<typeof insertFamilySchema>;
export type Family = typeof families.$inferSelect;

// Budget allocations table (per-person budget tracking for groups)
export const budgetAllocations = pgTable("budget_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // Nullable - either userId OR managedProfileId
  managedProfileId: varchar("managed_profile_id").references(() => managedProfiles.id, { onDelete: 'cascade' }), // Nullable - for children/dependents
  allocatedAmount: decimal("allocated_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_budget_allocations_family").on(table.familyId),
  index("idx_budget_allocations_user").on(table.userId, table.familyId),
  index("idx_budget_allocations_managed").on(table.managedProfileId, table.familyId),
]);

export const budgetAllocationsRelations = relations(budgetAllocations, ({ one }) => ({
  family: one(families, {
    fields: [budgetAllocations.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [budgetAllocations.userId],
    references: [users.id],
  }),
  managedProfile: one(managedProfiles, {
    fields: [budgetAllocations.managedProfileId],
    references: [managedProfiles.id],
  }),
}));

export const insertBudgetAllocationSchema = createInsertSchema(budgetAllocations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertBudgetAllocation = z.infer<typeof insertBudgetAllocationSchema>;
export type BudgetAllocation = typeof budgetAllocations.$inferSelect;

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
// Supports both wishlist purchases and off-wishlist purchases
export const itemPurchases = pgTable("item_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").references(() => wishlistItems.id, { onDelete: 'set null' }), // Nullable - preserves purchase record if item is deleted
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  purchasedById: varchar("purchased_by_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: 'cascade' }), // For off-wishlist purchases
  recipientManagedProfileId: varchar("recipient_managed_profile_id").references(() => managedProfiles.id, { onDelete: 'cascade' }), // For off-wishlist purchases
  price: decimal("price", { precision: 10, scale: 2 }), // Purchase amount (optional for wishlist items, required for off-wishlist)
  description: text("description"), // What was purchased (for off-wishlist items)
  purchasedFrom: text("purchased_from"), // Where it was purchased from
  notes: text("notes"), // Private notes about the purchase
  purchasedAt: timestamp("purchased_at").defaultNow(),
  // Snapshot fields: preserve item details even if original item is deleted
  itemSnapshot: text("item_snapshot"), // JSON snapshot of item at purchase time (name, imageUrl, url, priority)
}, (table) => [
  index("idx_purchases_family").on(table.familyId),
  index("idx_purchases_recipient_user").on(table.recipientUserId),
  index("idx_purchases_recipient_managed").on(table.recipientManagedProfileId),
]);

export const itemPurchasesRelations = relations(itemPurchases, ({ one }) => ({
  item: one(wishlistItems, {
    fields: [itemPurchases.itemId],
    references: [wishlistItems.id],
  }),
  family: one(families, {
    fields: [itemPurchases.familyId],
    references: [families.id],
  }),
  purchasedBy: one(users, {
    fields: [itemPurchases.purchasedById],
    references: [users.id],
  }),
  recipientUser: one(users, {
    fields: [itemPurchases.recipientUserId],
    references: [users.id],
  }),
  recipientManagedProfile: one(managedProfiles, {
    fields: [itemPurchases.recipientManagedProfileId],
    references: [managedProfiles.id],
  }),
}));

export const insertItemPurchaseSchema = createInsertSchema(itemPurchases).omit({
  id: true,
  purchasedAt: true,
});

// Schema for logging off-wishlist purchases
export const logOffWishlistPurchaseSchema = z.object({
  familyId: z.string().min(1, "Group ID is required"),
  recipientUserId: z.string().nullable(),
  recipientManagedProfileId: z.string().nullable(),
  price: z.number().min(0, "Price must be non-negative"),
  description: z.string().min(1, "Description is required"),
  purchasedFrom: z.string().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => {
    const hasUserId = data.recipientUserId !== null && data.recipientUserId !== undefined;
    const hasManagedProfileId = data.recipientManagedProfileId !== null && data.recipientManagedProfileId !== undefined;
    return hasUserId !== hasManagedProfileId; // XOR: exactly one must be true
  },
  { message: "Exactly one of recipientUserId or recipientManagedProfileId must be provided" }
);

export type InsertItemPurchase = z.infer<typeof insertItemPurchaseSchema>;
export type LogOffWishlistPurchase = z.infer<typeof logOffWishlistPurchaseSchema>;
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
  familyId: z.string().min(1, "Group ID is required"),
});

export type BulkDeleteItems = z.infer<typeof bulkDeleteItemsSchema>;

export const bulkUpdatePrioritySchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item ID is required").max(50, "Cannot update more than 50 items at once"),
  priority: z.enum(["low", "medium", "high"]),
  familyId: z.string().min(1, "Group ID is required"),
});

export type BulkUpdatePriority = z.infer<typeof bulkUpdatePrioritySchema>;

export const budgetAllocationItemSchema = z.object({
  userId: z.string().min(1).nullable(),
  managedProfileId: z.string().min(1).nullable(),
  allocatedAmount: z.number().min(0, "Budget allocation must be non-negative"),
}).refine(
  (data) => {
    const hasUserId = data.userId !== null && data.userId !== undefined && data.userId.trim() !== '';
    const hasManagedProfileId = data.managedProfileId !== null && data.managedProfileId !== undefined && data.managedProfileId.trim() !== '';
    return hasUserId !== hasManagedProfileId; // XOR: exactly one must be true
  },
  { message: "Exactly one of userId or managedProfileId must be provided" }
);

export const setBudgetAllocationsSchema = z.object({
  allocations: z.array(budgetAllocationItemSchema),
});

export type SetBudgetAllocations = z.infer<typeof setBudgetAllocationsSchema>;

// Occasion type enum for personal lists
export const occasionTypeEnum = z.enum([
  "birthday",
  "graduation",
  "wedding",
  "baby_shower",
  "anniversary",
  "housewarming",
  "holiday",
  "other"
]);

export type OccasionType = z.infer<typeof occasionTypeEnum>;

// Theme colors schema for personal lists
export const themeColorsSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
  background: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
}).nullable();

export type ThemeColors = z.infer<typeof themeColorsSchema>;

// Personal lists table
export const personalLists = pgTable("personal_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  occasionType: varchar("occasion_type", { length: 50 }).notNull(), // birthday, graduation, wedding, etc.
  description: text("description"),
  date: timestamp("date"), // Optional date for the occasion
  themeColors: jsonb("theme_colors").$type<ThemeColors>(), // {primary, accent, background}
  publicSlug: varchar("public_slug", { length: 120 }).unique(), // For public sharing
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_personal_lists_user").on(table.userId),
  index("idx_personal_lists_slug").on(table.publicSlug),
]);

export const personalListsRelations = relations(personalLists, ({ one, many }) => ({
  user: one(users, {
    fields: [personalLists.userId],
    references: [users.id],
  }),
  items: many(personalListItems),
}));

export const insertPersonalListSchema = createInsertSchema(personalLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  occasionType: occasionTypeEnum,
  themeColors: themeColorsSchema.optional(),
});

export type InsertPersonalList = z.infer<typeof insertPersonalListSchema>;
export type PersonalList = typeof personalLists.$inferSelect;

// Personal list items table
export const personalListItems = pgTable("personal_list_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => personalLists.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }),
  imageUrl: text("image_url"),
  link: text("link"), // URL to purchase
  priority: varchar("priority", { length: 20 }).default("medium"), // high, medium, low
  quantity: integer("quantity").default(1),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_personal_list_items_list").on(table.listId),
]);

export const personalListItemsRelations = relations(personalListItems, ({ one, many }) => ({
  list: one(personalLists, {
    fields: [personalListItems.listId],
    references: [personalLists.id],
  }),
  purchases: many(personalListPurchases),
}));

export const insertPersonalListItemSchema = createInsertSchema(personalListItems).omit({
  id: true,
  createdAt: true,
});

export type InsertPersonalListItem = z.infer<typeof insertPersonalListItemSchema>;
export type PersonalListItem = typeof personalListItems.$inferSelect;

// Personal list purchases table (for tracking who bought what)
export const personalListPurchases = pgTable("personal_list_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").notNull().references(() => personalListItems.id, { onDelete: 'cascade' }).unique(), // Unique: only one purchaser per item
  purchasedByUserId: varchar("purchased_by_user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  purchasedAt: timestamp("purchased_at").defaultNow(),
}, (table) => [
  index("idx_personal_list_purchases_item").on(table.itemId),
  index("idx_personal_list_purchases_user").on(table.purchasedByUserId),
]);

export const personalListPurchasesRelations = relations(personalListPurchases, ({ one }) => ({
  item: one(personalListItems, {
    fields: [personalListPurchases.itemId],
    references: [personalListItems.id],
  }),
  purchasedBy: one(users, {
    fields: [personalListPurchases.purchasedByUserId],
    references: [users.id],
  }),
}));

export const insertPersonalListPurchaseSchema = createInsertSchema(personalListPurchases).omit({
  id: true,
  purchasedAt: true,
});

export type InsertPersonalListPurchase = z.infer<typeof insertPersonalListPurchaseSchema>;
export type PersonalListPurchase = typeof personalListPurchases.$inferSelect;

// ============================================
// Cross-Family Wishlist Sharing Tables
// ============================================

// User Christmas wishlist sharing settings per family
// When enabled, user's Christmas list from their "home" family is visible to this family
export const userWishlistShares = pgTable("user_wishlist_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }), // Family that can VIEW the list
  sourceFamilyId: varchar("source_family_id").notNull().references(() => families.id, { onDelete: 'cascade' }), // Family where items actually live
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_wishlist_shares_user").on(table.userId),
  index("idx_user_wishlist_shares_family").on(table.familyId),
  unique("unique_user_wishlist_share").on(table.userId, table.familyId, table.sourceFamilyId),
]);

export const userWishlistSharesRelations = relations(userWishlistShares, ({ one }) => ({
  user: one(users, {
    fields: [userWishlistShares.userId],
    references: [users.id],
  }),
  family: one(families, {
    fields: [userWishlistShares.familyId],
    references: [families.id],
  }),
  sourceFamily: one(families, {
    fields: [userWishlistShares.sourceFamilyId],
    references: [families.id],
  }),
}));

export const insertUserWishlistShareSchema = createInsertSchema(userWishlistShares).omit({
  id: true,
  createdAt: true,
});

export type InsertUserWishlistShare = z.infer<typeof insertUserWishlistShareSchema>;
export type UserWishlistShare = typeof userWishlistShares.$inferSelect;

// Managed profile (child) wishlist sharing settings per family
export const managedWishlistShares = pgTable("managed_wishlist_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  managedProfileId: varchar("managed_profile_id").notNull().references(() => managedProfiles.id, { onDelete: 'cascade' }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }), // Family that can VIEW the list
  sourceFamilyId: varchar("source_family_id").notNull().references(() => families.id, { onDelete: 'cascade' }), // Family where items actually live
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_managed_wishlist_shares_profile").on(table.managedProfileId),
  index("idx_managed_wishlist_shares_family").on(table.familyId),
  unique("unique_managed_wishlist_share").on(table.managedProfileId, table.familyId, table.sourceFamilyId),
]);

export const managedWishlistSharesRelations = relations(managedWishlistShares, ({ one }) => ({
  managedProfile: one(managedProfiles, {
    fields: [managedWishlistShares.managedProfileId],
    references: [managedProfiles.id],
  }),
  family: one(families, {
    fields: [managedWishlistShares.familyId],
    references: [families.id],
  }),
  sourceFamily: one(families, {
    fields: [managedWishlistShares.sourceFamilyId],
    references: [families.id],
  }),
}));

export const insertManagedWishlistShareSchema = createInsertSchema(managedWishlistShares).omit({
  id: true,
  createdAt: true,
});

export type InsertManagedWishlistShare = z.infer<typeof insertManagedWishlistShareSchema>;
export type ManagedWishlistShare = typeof managedWishlistShares.$inferSelect;

// Personal list sharing with families
// Allows personal lists (birthday, etc.) to be visible within a family group
export const personalListFamilyShares = pgTable("personal_list_family_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  listId: varchar("list_id").notNull().references(() => personalLists.id, { onDelete: 'cascade' }),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_personal_list_family_shares_list").on(table.listId),
  index("idx_personal_list_family_shares_family").on(table.familyId),
  unique("unique_personal_list_family_share").on(table.listId, table.familyId),
]);

export const personalListFamilySharesRelations = relations(personalListFamilyShares, ({ one }) => ({
  list: one(personalLists, {
    fields: [personalListFamilyShares.listId],
    references: [personalLists.id],
  }),
  family: one(families, {
    fields: [personalListFamilyShares.familyId],
    references: [families.id],
  }),
}));

export const insertPersonalListFamilyShareSchema = createInsertSchema(personalListFamilyShares).omit({
  id: true,
  createdAt: true,
});

export type InsertPersonalListFamilyShare = z.infer<typeof insertPersonalListFamilyShareSchema>;
export type PersonalListFamilyShare = typeof personalListFamilyShares.$inferSelect;
