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

// Events table (for occasions like birthdays, weddings, Christmas, etc.)
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  familyId: varchar("family_id").notNull().references(() => families.id, { onDelete: 'cascade' }),
  name: varchar("name", { length: 255 }).notNull(),
  date: timestamp("date"), // Optional date for the event
  eventType: varchar("event_type", { length: 50 }).notNull(), // christmas, birthday, wedding, baby_shower, hanukkah, graduation, other
  themePrimary: varchar("theme_primary", { length: 7 }).default("#DC2626"), // Hex color code for primary
  themeAccent: varchar("theme_accent", { length: 7 }).default("#15803D"), // Hex color code for accent
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_events_family_lookup").on(table.familyId, table.isActive),
]);

export const eventsRelations = relations(events, ({ one, many }) => ({
  family: one(families, {
    fields: [events.familyId],
    references: [families.id],
  }),
  wishlistItems: many(wishlistItems),
  activityLogs: many(activityLogs),
}));

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// Budget allocations table (per-person budget tracking for events)
export const budgetAllocations = pgTable("budget_allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }), // Nullable - either userId OR managedProfileId
  managedProfileId: varchar("managed_profile_id").references(() => managedProfiles.id, { onDelete: 'cascade' }), // Nullable - for children/dependents
  allocatedAmount: decimal("allocated_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_budget_allocations_event").on(table.eventId),
  index("idx_budget_allocations_user").on(table.userId, table.eventId),
  index("idx_budget_allocations_managed").on(table.managedProfileId, table.eventId),
]);

export const budgetAllocationsRelations = relations(budgetAllocations, ({ one }) => ({
  event: one(events, {
    fields: [budgetAllocations.eventId],
    references: [events.id],
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
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }), // Nullable for backward compatibility
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
  index("idx_wishlist_items_event_lookup").on(table.eventId, table.familyId),
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
  event: one(events, {
    fields: [wishlistItems.eventId],
    references: [events.id],
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
  itemId: varchar("item_id").references(() => wishlistItems.id, { onDelete: 'cascade' }), // Nullable for off-wishlist purchases
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }), // Nullable during migration, will be populated
  purchasedById: varchar("purchased_by_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  recipientUserId: varchar("recipient_user_id").references(() => users.id, { onDelete: 'cascade' }), // For off-wishlist purchases
  recipientManagedProfileId: varchar("recipient_managed_profile_id").references(() => managedProfiles.id, { onDelete: 'cascade' }), // For off-wishlist purchases
  price: decimal("price", { precision: 10, scale: 2 }), // Purchase amount (optional for wishlist items, required for off-wishlist)
  description: text("description"), // What was purchased (for off-wishlist items)
  purchasedFrom: text("purchased_from"), // Where it was purchased from
  notes: text("notes"), // Private notes about the purchase
  purchasedAt: timestamp("purchased_at").defaultNow(),
}, (table) => [
  index("idx_purchases_event").on(table.eventId),
  index("idx_purchases_recipient_user").on(table.recipientUserId),
  index("idx_purchases_recipient_managed").on(table.recipientManagedProfileId),
]);

export const itemPurchasesRelations = relations(itemPurchases, ({ one }) => ({
  item: one(wishlistItems, {
    fields: [itemPurchases.itemId],
    references: [wishlistItems.id],
  }),
  event: one(events, {
    fields: [itemPurchases.eventId],
    references: [events.id],
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
  eventId: z.string().min(1, "Event ID is required"),
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
  eventId: varchar("event_id").references(() => events.id, { onDelete: 'cascade' }), // Nullable for backward compatibility
  actorId: varchar("actor_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  targetUserId: varchar("target_user_id").references(() => users.id, { onDelete: 'cascade' }), // Optional: user affected by action
  itemId: varchar("item_id").references(() => wishlistItems.id, { onDelete: 'cascade' }), // Optional: related wishlist item
  action: varchar("action", { length: 50 }).notNull(), // item_added, item_purchased, item_deleted, member_joined, etc.
  metadata: jsonb("metadata"), // Additional data (e.g., item name, price, etc.)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_activity_logs_family_created").on(table.familyId, table.createdAt),
  index("idx_activity_logs_event_created").on(table.eventId, table.createdAt),
]);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  family: one(families, {
    fields: [activityLogs.familyId],
    references: [families.id],
  }),
  event: one(events, {
    fields: [activityLogs.eventId],
    references: [events.id],
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
  eventId: z.string().min(1, "Event ID is required"),
});

export type BulkDeleteItems = z.infer<typeof bulkDeleteItemsSchema>;

export const bulkUpdatePrioritySchema = z.object({
  itemIds: z.array(z.string()).min(1, "At least one item ID is required").max(50, "Cannot update more than 50 items at once"),
  priority: z.enum(["low", "medium", "high"]),
  familyId: z.string().min(1, "Family ID is required"),
  eventId: z.string().min(1, "Event ID is required"),
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
