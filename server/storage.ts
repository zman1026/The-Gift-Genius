import {
  users,
  families,
  familyMembers,
  wishlistItems,
  itemPurchases,
  activityLogs,
  managedProfiles,
  type User,
  type UpsertUser,
  type Family,
  type InsertFamily,
  type FamilyMember,
  type InsertFamilyMember,
  type WishlistItem,
  type InsertWishlistItem,
  type ItemPurchase,
  type InsertItemPurchase,
  type ActivityLog,
  type InsertActivityLog,
  type ManagedProfile,
  type InsertManagedProfile,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, desc, asc, inArray } from "drizzle-orm";

// Custom error types for better error handling
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface WishlistFilterOptions {
  sort?: 'name' | 'price' | 'priority' | 'createdAt';
  order?: 'asc' | 'desc';
  priority?: 'high' | 'medium' | 'low';
  itemType?: 'product' | 'experience' | 'service' | 'membership' | 'other';
}

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  
  // Family operations
  createFamily(family: InsertFamily): Promise<Family>;
  getFamilyByInviteCode(inviteCode: string): Promise<Family | undefined>;
  getUserFamilies(userId: string): Promise<any[]>;
  getFamily(id: string): Promise<Family | undefined>;
  updateFamily(id: string, updates: Partial<InsertFamily>, requesterId: string): Promise<Family>;
  
  // Family member operations
  addFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  getFamilyMembers(userId: string): Promise<any[]>;
  getFamilyMember(familyId: string, userId: string): Promise<FamilyMember | undefined>;
  updateFamilyMemberDisplayName(familyId: string, userId: string, displayName: string | null, requesterId: string): Promise<FamilyMember>;
  removeFamilyMember(familyId: string, userIdToRemove: string, requesterId: string): Promise<void>;
  leaveFamily(familyId: string, userId: string): Promise<void>;
  
  // Managed profile operations (children/dependents)
  createManagedProfile(profile: InsertManagedProfile, familyId: string): Promise<ManagedProfile>;
  updateManagedProfile(id: string, updates: Partial<InsertManagedProfile>, requesterId: string): Promise<ManagedProfile>;
  deleteManagedProfile(id: string, familyId: string, requesterId: string): Promise<void>;
  getManagedProfile(id: string): Promise<ManagedProfile | undefined>;
  getManagedProfilesByCreator(createdById: string): Promise<ManagedProfile[]>;
  
  // Wishlist operations
  createWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  updateWishlistItem(id: string, item: Partial<InsertWishlistItem>): Promise<WishlistItem>;
  deleteWishlistItem(id: string): Promise<void>;
  bulkDeleteWishlistItems(userId: string, familyId: string, itemIds: string[]): Promise<WishlistItem[]>;
  bulkUpdateWishlistPriority(userId: string, familyId: string, itemIds: string[], priority: 'low' | 'medium' | 'high'): Promise<WishlistItem[]>;
  getUserWishlistItems(userId: string, options?: WishlistFilterOptions): Promise<WishlistItem[]>;
  getUserWishlistItemsByFamily(userId: string, familyId: string, options?: WishlistFilterOptions): Promise<WishlistItem[]>;
  getMemberWishlistItems(userId: string, viewerId: string, familyId?: string): Promise<any[]>;
  getWishlistItem(id: string): Promise<WishlistItem | undefined>;
  findDuplicateWishlistItem(userId: string, familyId: string, url?: string, productId?: string): Promise<WishlistItem | undefined>;
  
  // Purchase operations
  markItemPurchased(purchase: InsertItemPurchase): Promise<ItemPurchase>;
  unmarkItemPurchased(itemId: string, userId: string): Promise<void>;
  getItemPurchase(itemId: string): Promise<ItemPurchase | undefined>;
  getPurchasedItemsByUser(userId: string, familyId: string): Promise<any[]>;
  
  // Stats operations
  getUserStats(userId: string): Promise<any>;
  
  // Activity log operations
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getRecentActivities(familyId: string, limit?: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Family operations
  async createFamily(familyData: InsertFamily): Promise<Family> {
    const [family] = await db.insert(families).values(familyData).returning();
    
    // Automatically add creator as a member
    await this.addFamilyMember({
      familyId: family.id,
      userId: family.createdById,
    });
    
    return family;
  }

  async getFamilyByInviteCode(inviteCode: string): Promise<Family | undefined> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.inviteCode, inviteCode));
    return family;
  }

  async getUserFamilies(userId: string): Promise<any[]> {
    const result = await db
      .select({
        id: families.id,
        name: families.name,
        inviteCode: families.inviteCode,
        createdById: families.createdById,
        createdAt: families.createdAt,
        memberCount: sql<number>`count(distinct ${familyMembers.userId})::int`,
        giftBudget: sql<string | null>`
          (SELECT gift_budget FROM family_members 
           WHERE family_id = ${families.id} AND user_id = ${userId} LIMIT 1)
        `,
      })
      .from(families)
      .innerJoin(familyMembers, eq(families.id, familyMembers.familyId))
      .where(eq(familyMembers.userId, userId))
      .groupBy(families.id);
    
    return result;
  }

  async getFamily(id: string): Promise<Family | undefined> {
    const [family] = await db.select().from(families).where(eq(families.id, id));
    return family;
  }

  async updateFamily(id: string, updates: Partial<InsertFamily>, requesterId: string): Promise<Family> {
    // Get family to check if requester is the organizer
    const [family] = await db.select().from(families).where(eq(families.id, id));
    
    if (!family) {
      throw new Error("Family not found");
    }
    
    if (family.createdById !== requesterId) {
      throw new Error("Only the family organizer can update the family");
    }
    
    const [updatedFamily] = await db
      .update(families)
      .set(updates)
      .where(eq(families.id, id))
      .returning();
    
    return updatedFamily;
  }

  // Family member operations
  async addFamilyMember(memberData: InsertFamilyMember): Promise<FamilyMember> {
    const [member] = await db.insert(familyMembers).values(memberData).returning();
    return member;
  }

  async getFamilyMembers(userId: string): Promise<any[]> {
    // Get all unique family members from families the user belongs to
    const result = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        itemCount: sql<number>`count(distinct ${wishlistItems.id})::int`,
      })
      .from(familyMembers)
      .innerJoin(
        sql`${familyMembers} as fm2`,
        sql`${familyMembers.familyId} = fm2.family_id and fm2.user_id = ${userId}`
      )
      .innerJoin(users, eq(familyMembers.userId, users.id))
      .leftJoin(
        wishlistItems,
        and(
          eq(wishlistItems.userId, users.id),
          eq(wishlistItems.familyId, familyMembers.familyId)
        )
      )
      .groupBy(users.id);
    
    return result;
  }

  async getFamilyMembersByFamily(familyId: string, requestingUserId: string): Promise<any[]> {
    // First verify that the requesting user is a member of this family
    const membership = await this.getFamilyMember(familyId, requestingUserId);
    if (!membership) {
      throw new Error("You are not a member of this family");
    }

    // Get all family members (both users and managed profiles) for a specific family
    const result = await db.execute(sql`
      SELECT 
        COALESCE(u.id, mp.id) as "userId",
        COALESCE(u.email, NULL) as email,
        COALESCE(u.first_name, mp.first_name) as "firstName",
        COALESCE(u.last_name, mp.last_name) as "lastName",
        COALESCE(u.profile_image_url, mp.profile_image_url) as "profileImageUrl",
        fm.display_name as "displayName",
        mp.created_by_id as "createdById",
        CASE WHEN mp.id IS NOT NULL THEN true ELSE false END as "isManagedProfile",
        COUNT(DISTINCT wi.id)::int as "itemCount"
      FROM family_members fm
      LEFT JOIN users u ON fm.user_id = u.id
      LEFT JOIN managed_profiles mp ON fm.managed_profile_id = mp.id
      LEFT JOIN wishlist_items wi ON 
        (wi.user_id = u.id OR wi.managed_profile_id = mp.id) 
        AND wi.family_id = ${familyId}
      WHERE fm.family_id = ${familyId}
      GROUP BY 
        u.id, 
        u.email, 
        u.first_name, 
        u.last_name, 
        u.profile_image_url,
        mp.id,
        mp.first_name,
        mp.last_name,
        mp.profile_image_url,
        mp.created_by_id,
        fm.display_name
    `);
    
    return result.rows as any[];
  }

  async getFamilyMember(familyId: string, userId: string): Promise<FamilyMember | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
    return member;
  }

  async updateFamilyMemberDisplayName(familyId: string, userId: string, displayName: string | null, requesterId: string): Promise<FamilyMember> {
    // Check if requester is the family organizer
    const [family] = await db.select().from(families).where(eq(families.id, familyId));
    
    if (!family) {
      throw new Error("Family not found");
    }
    
    if (family.createdById !== requesterId) {
      throw new Error("Only the family organizer can update member display names");
    }
    
    const [member] = await db
      .update(familyMembers)
      .set({ displayName })
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)))
      .returning();
    
    if (!member) {
      throw new Error("Family member not found");
    }
    
    return member;
  }

  async updateFamilyMemberBudget(familyId: string, userId: string, giftBudget: string | null): Promise<FamilyMember> {
    const [member] = await db
      .update(familyMembers)
      .set({ giftBudget })
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)))
      .returning();
    
    if (!member) {
      throw new Error("Family member not found");
    }
    
    return member;
  }

  async removeFamilyMember(familyId: string, userIdToRemove: string, requesterId: string): Promise<void> {
    // Check if requester is the family organizer
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId));
    
    if (!family) {
      throw new Error("Family not found");
    }
    
    if (family.createdById !== requesterId) {
      throw new Error("Only the family organizer can remove members");
    }
    
    // Don't allow removing themselves using this method
    if (requesterId === userIdToRemove) {
      throw new Error("Use leave family to remove yourself");
    }
    
    // Remove the member
    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userIdToRemove)));
  }

  async leaveFamily(familyId: string, userId: string): Promise<void> {
    // Check if user is the organizer
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId));
    
    if (!family) {
      throw new Error("Family not found");
    }
    
    // Check if this is the last member
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));
    
    // If they're the organizer and last member, delete the whole family
    if (family.createdById === userId && members.length === 1) {
      await db.delete(families).where(eq(families.id, familyId));
      return;
    }
    
    // If they're the organizer but not the last member, they need to transfer ownership first
    if (family.createdById === userId && members.length > 1) {
      throw new Error("As the family organizer, you must transfer ownership or remove all other members before leaving");
    }
    
    // Remove the member
    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
  }

  // Managed profile operations (children/dependents)
  async createManagedProfile(profileData: InsertManagedProfile, familyId: string): Promise<ManagedProfile> {
    // Verify the creator is a member of the family
    const membership = await this.getFamilyMember(familyId, profileData.createdById);
    if (!membership) {
      throw new AuthorizationError("You must be a member of the family to create a child profile");
    }

    // Create the managed profile
    const [profile] = await db.insert(managedProfiles).values(profileData).returning();
    
    // Automatically add the managed profile as a family member
    await db.insert(familyMembers).values({
      familyId,
      managedProfileId: profile.id,
      userId: null,
    });
    
    return profile;
  }

  async updateManagedProfile(id: string, updates: Partial<InsertManagedProfile>, requesterId: string): Promise<ManagedProfile> {
    // Get the profile to verify ownership
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, id));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Verify the requester is the creator
    if (profile.createdById !== requesterId) {
      throw new AuthorizationError("You can only edit child profiles you created");
    }
    
    // Update the profile
    const [updatedProfile] = await db
      .update(managedProfiles)
      .set(updates)
      .where(eq(managedProfiles.id, id))
      .returning();
    
    return updatedProfile;
  }

  async deleteManagedProfile(id: string, familyId: string, requesterId: string): Promise<void> {
    // Get the profile to verify ownership
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, id));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Verify the requester is the creator
    if (profile.createdById !== requesterId) {
      throw new AuthorizationError("You can only delete child profiles you created");
    }
    
    // Delete the profile (cascade will handle familyMembers and wishlistItems)
    await db.delete(managedProfiles).where(eq(managedProfiles.id, id));
  }

  async getManagedProfile(id: string): Promise<ManagedProfile | undefined> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, id));
    return profile;
  }

  async getManagedProfilesByCreator(createdById: string): Promise<ManagedProfile[]> {
    const profiles = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.createdById, createdById));
    return profiles;
  }

  // Wishlist operations
  async createWishlistItem(itemData: InsertWishlistItem): Promise<WishlistItem> {
    const [item] = await db.insert(wishlistItems).values(itemData).returning();
    return item;
  }

  async updateWishlistItem(id: string, itemData: Partial<InsertWishlistItem>): Promise<WishlistItem> {
    const [item] = await db
      .update(wishlistItems)
      .set(itemData)
      .where(eq(wishlistItems.id, id))
      .returning();
    return item;
  }

  async deleteWishlistItem(id: string): Promise<void> {
    await db.delete(wishlistItems).where(eq(wishlistItems.id, id));
  }

  async bulkDeleteWishlistItems(userId: string, familyId: string, itemIds: string[]): Promise<WishlistItem[]> {
    // Verify user is a member of the family
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new AuthorizationError("You are not a member of this family");
    }

    // Fetch all items to verify ownership and family membership
    const items = await db
      .select()
      .from(wishlistItems)
      .where(and(
        inArray(wishlistItems.id, itemIds),
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.familyId, familyId)
      ));

    // Check if any items were not found or don't belong to the user/family
    if (items.length < itemIds.length) {
      const foundIds = new Set(items.map(item => item.id));
      const missingIds = itemIds.filter(id => !foundIds.has(id));
      throw new AuthorizationError(`Cannot delete ${missingIds.length} item(s): not found or unauthorized`);
    }

    // Delete all items
    await db
      .delete(wishlistItems)
      .where(and(
        inArray(wishlistItems.id, itemIds),
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.familyId, familyId)
      ));

    return items;
  }

  async bulkUpdateWishlistPriority(userId: string, familyId: string, itemIds: string[], priority: 'low' | 'medium' | 'high'): Promise<WishlistItem[]> {
    // Verify user is a member of the family
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new AuthorizationError("You are not a member of this family");
    }

    // Verify all items belong to the user and family
    const existingItems = await db
      .select()
      .from(wishlistItems)
      .where(and(
        inArray(wishlistItems.id, itemIds),
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.familyId, familyId)
      ));

    // Check if any items were not found or don't belong to the user/family
    if (existingItems.length < itemIds.length) {
      const foundIds = new Set(existingItems.map(item => item.id));
      const missingIds = itemIds.filter(id => !foundIds.has(id));
      throw new AuthorizationError(`Cannot update ${missingIds.length} item(s): not found or unauthorized`);
    }

    // Update all items
    const items = await db
      .update(wishlistItems)
      .set({ priority })
      .where(and(
        inArray(wishlistItems.id, itemIds),
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.familyId, familyId)
      ))
      .returning();

    return items;
  }

  async getUserWishlistItems(userId: string, options?: WishlistFilterOptions): Promise<WishlistItem[]> {
    // Build where conditions
    const whereConditions = [eq(wishlistItems.userId, userId)];
    
    if (options?.priority) {
      whereConditions.push(eq(wishlistItems.priority, options.priority));
    }
    
    if (options?.itemType) {
      whereConditions.push(eq(wishlistItems.itemType, options.itemType));
    }
    
    // Build order by clauses (primary + secondary for stable sorting)
    const orderByClauses = [];
    const orderDirection = options?.order === 'asc' ? asc : desc;
    
    switch (options?.sort) {
      case 'name':
        orderByClauses.push(orderDirection(sql`LOWER(${wishlistItems.name})`));
        orderByClauses.push(desc(wishlistItems.createdAt)); // Secondary: newest first
        break;
      case 'price':
        // Handle nulls: nulls last for both asc and desc
        if (options?.order === 'asc') {
          orderByClauses.push(sql`${wishlistItems.price} ASC NULLS LAST`);
        } else {
          orderByClauses.push(sql`${wishlistItems.price} DESC NULLS LAST`);
        }
        orderByClauses.push(desc(wishlistItems.createdAt)); // Secondary: newest first
        break;
      case 'priority':
        // Priority sorting: low=1, medium=2, high=3
        // DESC: 3→2→1 = high→medium→low
        // ASC: 1→2→3 = low→medium→high
        orderByClauses.push(sql`CASE ${wishlistItems.priority} 
          WHEN 'low' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'high' THEN 3 
          ELSE 0
          END ${options?.order === 'asc' ? sql`ASC` : sql`DESC`}`);
        orderByClauses.push(desc(wishlistItems.createdAt)); // Secondary: newest first
        break;
      case 'createdAt':
      default:
        // Default: newest first (desc createdAt)
        orderByClauses.push(orderDirection(wishlistItems.createdAt));
        break;
    }
    
    // Fallback: ensure we always have at least one ordering clause
    if (orderByClauses.length === 0) {
      orderByClauses.push(desc(wishlistItems.createdAt));
    }
    
    const items = await db
      .select()
      .from(wishlistItems)
      .where(and(...whereConditions))
      .orderBy(...orderByClauses);
    
    return items as WishlistItem[];
  }

  async getUserWishlistItemsByFamily(userId: string, familyId: string, options?: WishlistFilterOptions): Promise<WishlistItem[]> {
    // First verify that the user is a member of this family
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this family");
    }

    // Build where conditions
    const whereConditions = [
      eq(wishlistItems.userId, userId),
      eq(wishlistItems.familyId, familyId)
    ];
    
    if (options?.priority) {
      whereConditions.push(eq(wishlistItems.priority, options.priority));
    }
    
    if (options?.itemType) {
      whereConditions.push(eq(wishlistItems.itemType, options.itemType));
    }
    
    // Build order by clauses (primary + secondary for stable sorting)
    const orderByClauses = [];
    const orderDirection = options?.order === 'asc' ? asc : desc;
    
    switch (options?.sort) {
      case 'name':
        orderByClauses.push(orderDirection(sql`LOWER(${wishlistItems.name})`));
        orderByClauses.push(desc(wishlistItems.createdAt)); // Secondary: newest first
        break;
      case 'price':
        // Handle nulls: nulls last for both asc and desc
        if (options?.order === 'asc') {
          orderByClauses.push(sql`${wishlistItems.price} ASC NULLS LAST`);
        } else {
          orderByClauses.push(sql`${wishlistItems.price} DESC NULLS LAST`);
        }
        orderByClauses.push(desc(wishlistItems.createdAt)); // Secondary: newest first
        break;
      case 'priority':
        // Priority sorting: low=1, medium=2, high=3
        // DESC: 3→2→1 = high→medium→low
        // ASC: 1→2→3 = low→medium→high
        orderByClauses.push(sql`CASE ${wishlistItems.priority} 
          WHEN 'low' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'high' THEN 3 
          ELSE 0
          END ${options?.order === 'asc' ? sql`ASC` : sql`DESC`}`);
        orderByClauses.push(desc(wishlistItems.createdAt)); // Secondary: newest first
        break;
      case 'createdAt':
      default:
        // Default: newest first (desc createdAt)
        orderByClauses.push(orderDirection(wishlistItems.createdAt));
        break;
    }
    
    // Fallback: ensure we always have at least one ordering clause
    if (orderByClauses.length === 0) {
      orderByClauses.push(desc(wishlistItems.createdAt));
    }

    const items = await db
      .select()
      .from(wishlistItems)
      .where(and(...whereConditions))
      .orderBy(...orderByClauses);
    
    return items as WishlistItem[];
  }

  async getMemberWishlistItems(memberId: string, viewerId: string, familyId?: string): Promise<any[]> {
    // First, determine if this is a userId or managedProfileId by checking the family_members table
    const memberCheck = await db
      .select({ 
        userId: familyMembers.userId, 
        managedProfileId: familyMembers.managedProfileId 
      })
      .from(familyMembers)
      .where(
        or(
          eq(familyMembers.userId, memberId),
          eq(familyMembers.managedProfileId, memberId)
        )
      )
      .limit(1);

    if (memberCheck.length === 0) {
      throw new Error("Member not found");
    }

    const isUserId = memberCheck[0].userId === memberId;
    const isManagedProfile = memberCheck[0].managedProfileId === memberId;

    // Get all families that both the member and viewer share
    const sharedFamilies = await db
      .select({ familyId: sql<string>`fm1.family_id` })
      .from(sql`${familyMembers} as fm1`)
      .innerJoin(
        sql`${familyMembers} as fm2`,
        sql`fm1.family_id = fm2.family_id`
      )
      .where(
        and(
          isUserId 
            ? sql`fm1.user_id = ${memberId}`
            : sql`fm1.managed_profile_id = ${memberId}`,
          sql`fm2.user_id = ${viewerId}`
        )
      );

    if (sharedFamilies.length === 0) {
      throw new Error("You do not share any families with this member");
    }

    const sharedFamilyIds = sharedFamilies.map(f => f.familyId);

    // If familyId is provided, verify it's in the shared families
    if (familyId) {
      if (!sharedFamilyIds.includes(familyId)) {
        throw new Error("You do not share this family with this member");
      }
    }

    // Build where conditions - filter by specific family if provided, otherwise all shared families
    const memberCondition = isUserId 
      ? eq(wishlistItems.userId, memberId)
      : eq(wishlistItems.managedProfileId, memberId);
    
    const familyCondition = familyId
      ? eq(wishlistItems.familyId, familyId)
      : sql`${wishlistItems.familyId} = ANY(${sharedFamilyIds})`;

    const whereConditions = and(memberCondition, familyCondition);

    // Only return items from shared families (or specific family if provided)
    const items = await db
      .select({
        id: wishlistItems.id,
        userId: wishlistItems.userId,
        managedProfileId: wishlistItems.managedProfileId,
        familyId: wishlistItems.familyId,
        name: wishlistItems.name,
        description: wishlistItems.description,
        price: wishlistItems.price,
        url: wishlistItems.url,
        imageUrl: wishlistItems.imageUrl,
        source: wishlistItems.source,
        productId: wishlistItems.productId,
        priority: wishlistItems.priority,
        quantity: wishlistItems.quantity,
        category: wishlistItems.category,
        itemType: wishlistItems.itemType,
        createdAt: wishlistItems.createdAt,
        purchase: sql<any>`
          CASE 
            WHEN ${itemPurchases.id} IS NOT NULL THEN
              json_build_object(
                'id', ${itemPurchases.id},
                'purchasedById', ${itemPurchases.purchasedById},
                'notes', ${itemPurchases.notes},
                'purchasedAt', ${itemPurchases.purchasedAt}
              )
            ELSE NULL
          END
        `,
      })
      .from(wishlistItems)
      .leftJoin(
        itemPurchases,
        and(
          eq(wishlistItems.id, itemPurchases.itemId),
          eq(itemPurchases.purchasedById, viewerId)
        )
      )
      .where(whereConditions)
      .orderBy(sql`${wishlistItems.createdAt} desc`);
    
    return items;
  }

  async getWishlistItem(id: string): Promise<WishlistItem | undefined> {
    const [item] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id));
    return item;
  }

  async findDuplicateWishlistItem(
    userId: string,
    familyId: string,
    url?: string,
    productId?: string
  ): Promise<WishlistItem | undefined> {
    // Check for duplicate by URL or productId
    if (!url && !productId) {
      return undefined;
    }

    // Base conditions (user and family must match)
    const baseConditions = and(
      eq(wishlistItems.userId, userId),
      eq(wishlistItems.familyId, familyId)
    );

    // Build OR condition for URL and/or productId
    const matchConditions = [];
    
    if (url) {
      // Case-insensitive URL comparison
      matchConditions.push(sql`LOWER(${wishlistItems.url}) = LOWER(${url})`);
    }
    
    if (productId) {
      // Exact productId match
      matchConditions.push(eq(wishlistItems.productId, productId));
    }

    // Combine: must match user+family AND (URL OR productId)
    const whereClause = matchConditions.length === 1
      ? and(baseConditions, matchConditions[0])
      : and(baseConditions, sql`(${matchConditions[0]} OR ${matchConditions[1]})`);

    const [item] = await db
      .select()
      .from(wishlistItems)
      .where(whereClause)
      .limit(1);

    return item;
  }

  // Purchase operations
  async markItemPurchased(purchaseData: InsertItemPurchase): Promise<ItemPurchase> {
    const [purchase] = await db.insert(itemPurchases).values(purchaseData).returning();
    return purchase;
  }

  async unmarkItemPurchased(itemId: string, userId: string): Promise<void> {
    await db
      .delete(itemPurchases)
      .where(and(eq(itemPurchases.itemId, itemId), eq(itemPurchases.purchasedById, userId)));
  }

  async getItemPurchase(itemId: string): Promise<ItemPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(itemPurchases)
      .where(eq(itemPurchases.itemId, itemId));
    return purchase;
  }

  async getUserPurchaseForItem(itemId: string, userId: string): Promise<ItemPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(itemPurchases)
      .where(and(eq(itemPurchases.itemId, itemId), eq(itemPurchases.purchasedById, userId)));
    return purchase;
  }

  async getPurchasedItemsByUser(userId: string, familyId: string): Promise<any[]> {
    const purchases = await db
      .select({
        id: itemPurchases.id,
        itemId: itemPurchases.itemId,
        notes: itemPurchases.notes,
        purchasedAt: itemPurchases.purchasedAt,
        item: {
          id: wishlistItems.id,
          name: wishlistItems.name,
          description: wishlistItems.description,
          price: wishlistItems.price,
          url: wishlistItems.url,
          imageUrl: wishlistItems.imageUrl,
          priority: wishlistItems.priority,
          quantity: wishlistItems.quantity,
          category: wishlistItems.category,
          userId: wishlistItems.userId,
        },
        purchaser: {
          id: sql<string>`purchaser.id`,
          email: sql<string>`purchaser.email`,
          firstName: sql<string>`purchaser.first_name`,
          lastName: sql<string>`purchaser.last_name`,
          profileImageUrl: sql<string>`purchaser.profile_image_url`,
        },
        owner: {
          id: sql<string>`owner.id`,
          email: sql<string>`owner.email`,
          firstName: sql<string>`owner.first_name`,
          lastName: sql<string>`owner.last_name`,
          profileImageUrl: sql<string>`owner.profile_image_url`,
        },
      })
      .from(itemPurchases)
      .innerJoin(wishlistItems, eq(itemPurchases.itemId, wishlistItems.id))
      .innerJoin(sql`users AS purchaser`, sql`${itemPurchases.purchasedById} = purchaser.id`)
      .innerJoin(sql`users AS owner`, sql`${wishlistItems.userId} = owner.id`)
      .where(
        and(
          eq(wishlistItems.familyId, familyId),
          eq(itemPurchases.purchasedById, userId)
        )
      )
      .orderBy(sql`${itemPurchases.purchasedAt} desc`);

    return purchases;
  }

  // Stats operations
  async getUserStats(userId: string): Promise<any> {
    // Single optimized query using raw SQL for maximum performance
    const result = await db.execute(sql`
      SELECT 
        (
          SELECT COUNT(*)::int
          FROM ${wishlistItems}
          WHERE user_id = ${userId}
        ) as my_items_count,
        (
          SELECT COUNT(DISTINCT user_id)::int
          FROM ${familyMembers}
          WHERE family_id IN (
            SELECT family_id
            FROM ${familyMembers}
            WHERE user_id = ${userId}
          )
        ) as family_members_count,
        (
          SELECT COUNT(*)::int
          FROM ${wishlistItems} wi
          LEFT JOIN ${itemPurchases} ip ON wi.id = ip.item_id
          WHERE wi.family_id IN (
            SELECT family_id
            FROM ${familyMembers}
            WHERE user_id = ${userId}
          )
          AND wi.user_id != ${userId}
          AND ip.id IS NULL
          AND wi.priority = 'high'
        ) as items_to_purchase_count
    `);

    const row = result.rows[0] as any;
    return {
      myItemsCount: row?.my_items_count || 0,
      familyMembersCount: row?.family_members_count || 0,
      itemsToPurchaseCount: row?.items_to_purchase_count || 0,
    };
  }

  async getUserStatsByFamily(userId: string, familyId: string): Promise<any> {
    // First verify that the user is a member of this family
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this family");
    }

    // Single optimized query using raw SQL for maximum performance
    const result = await db.execute(sql`
      SELECT 
        (
          SELECT COUNT(*)::int
          FROM ${wishlistItems}
          WHERE user_id = ${userId}
          AND family_id = ${familyId}
        ) as my_items_count,
        (
          SELECT COUNT(DISTINCT user_id)::int
          FROM ${familyMembers}
          WHERE family_id = ${familyId}
        ) as family_members_count,
        (
          SELECT COUNT(*)::int
          FROM ${wishlistItems} wi
          LEFT JOIN ${itemPurchases} ip ON wi.id = ip.item_id
          WHERE wi.family_id = ${familyId}
          AND wi.user_id != ${userId}
          AND ip.id IS NULL
          AND wi.priority = 'high'
        ) as items_to_purchase_count,
        (
          SELECT COALESCE(
            SUM(
              CASE 
                WHEN wi.price IS NULL OR wi.price = '' THEN 0
                ELSE 
                  CASE 
                    WHEN REGEXP_REPLACE(wi.price, '[^0-9.]', '', 'g') = '' THEN 0
                    ELSE REGEXP_REPLACE(wi.price, '[^0-9.]', '', 'g')::numeric
                  END
              END
            ), 
            0
          )::text
          FROM ${itemPurchases} ip
          INNER JOIN ${wishlistItems} wi ON ip.item_id = wi.id
          WHERE ip.purchased_by_id = ${userId}
          AND wi.family_id = ${familyId}
        ) as total_purchased
    `);

    const row = result.rows[0] as any;
    return {
      myItemsCount: row?.my_items_count || 0,
      familyMembersCount: row?.family_members_count || 0,
      itemsToPurchaseCount: row?.items_to_purchase_count || 0,
      totalPurchased: parseFloat(row?.total_purchased || '0'),
    };
  }

  async getPurchaseTotalsByMember(userId: string, familyId: string) {
    // Verify membership
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this family");
    }

    // Get purchase totals grouped by wishlist owner (person receiving the gift)
    // Strip currency symbols and convert to numeric safely
    const result = await db.execute(sql`
      SELECT 
        wi.user_id,
        COALESCE(
          SUM(
            CASE 
              WHEN wi.price IS NULL OR wi.price = '' THEN 0
              ELSE 
                CASE 
                  WHEN REGEXP_REPLACE(wi.price, '[^0-9.]', '', 'g') = '' THEN 0
                  ELSE REGEXP_REPLACE(wi.price, '[^0-9.]', '', 'g')::numeric
                END
            END
          ), 
          0
        )::text as total_spent,
        COUNT(ip.id)::int as items_purchased
      FROM ${itemPurchases} ip
      INNER JOIN ${wishlistItems} wi ON ip.item_id = wi.id
      WHERE ip.purchased_by_id = ${userId}
        AND wi.family_id = ${familyId}
      GROUP BY wi.user_id
    `);

    return result.rows.map((row: any) => ({
      userId: row.user_id,
      totalSpent: parseFloat(row.total_spent || '0'),
      itemsPurchased: row.items_purchased || 0,
    }));
  }

  // Activity log operations
  async createActivityLog(log: InsertActivityLog): Promise<ActivityLog> {
    const [activity] = await db
      .insert(activityLogs)
      .values(log)
      .returning();
    return activity;
  }

  async getRecentActivities(familyId: string, limit: number = 10): Promise<any[]> {
    const activities = await db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        metadata: activityLogs.metadata,
        createdAt: activityLogs.createdAt,
        actor: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.actorId, users.id))
      .where(eq(activityLogs.familyId, familyId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);

    return activities;
  }
}

export const storage = new DatabaseStorage();
