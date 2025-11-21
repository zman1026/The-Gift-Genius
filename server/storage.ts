import {
  users,
  families,
  familyMembers,
  wishlistItems,
  itemPurchases,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

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
  
  // Wishlist operations
  createWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  updateWishlistItem(id: string, item: Partial<InsertWishlistItem>): Promise<WishlistItem>;
  deleteWishlistItem(id: string): Promise<void>;
  getUserWishlistItems(userId: string): Promise<WishlistItem[]>;
  getMemberWishlistItems(userId: string, viewerId: string, familyId?: string): Promise<any[]>;
  getWishlistItem(id: string): Promise<WishlistItem | undefined>;
  
  // Purchase operations
  markItemPurchased(purchase: InsertItemPurchase): Promise<ItemPurchase>;
  unmarkItemPurchased(itemId: string, userId: string): Promise<void>;
  getItemPurchase(itemId: string): Promise<ItemPurchase | undefined>;
  getPurchasedItemsByUser(userId: string, familyId: string): Promise<any[]>;
  
  // Stats operations
  getUserStats(userId: string): Promise<any>;
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

    // Get all family members for a specific family
    const result = await db
      .select({
        userId: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        displayName: familyMembers.displayName,
        itemCount: sql<number>`count(distinct ${wishlistItems.id})::int`,
      })
      .from(familyMembers)
      .innerJoin(users, eq(familyMembers.userId, users.id))
      .leftJoin(
        wishlistItems,
        and(
          eq(wishlistItems.userId, users.id),
          eq(wishlistItems.familyId, familyId)
        )
      )
      .where(eq(familyMembers.familyId, familyId))
      .groupBy(users.id, familyMembers.displayName);
    
    return result;
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

  async getUserWishlistItems(userId: string): Promise<WishlistItem[]> {
    const items = await db
      .select({
        id: wishlistItems.id,
        userId: wishlistItems.userId,
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
        createdAt: wishlistItems.createdAt,
      })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId))
      .orderBy(sql`${wishlistItems.createdAt} desc`);
    return items as WishlistItem[];
  }

  async getUserWishlistItemsByFamily(userId: string, familyId: string): Promise<WishlistItem[]> {
    // First verify that the user is a member of this family
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this family");
    }

    const items = await db
      .select({
        id: wishlistItems.id,
        userId: wishlistItems.userId,
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
        createdAt: wishlistItems.createdAt,
      })
      .from(wishlistItems)
      .where(and(eq(wishlistItems.userId, userId), eq(wishlistItems.familyId, familyId)))
      .orderBy(sql`${wishlistItems.createdAt} desc`);
    return items as WishlistItem[];
  }

  async getMemberWishlistItems(userId: string, viewerId: string, familyId?: string): Promise<any[]> {
    // First, get all families that both users share
    const sharedFamilies = await db
      .select({ familyId: sql<string>`fm1.family_id` })
      .from(sql`${familyMembers} as fm1`)
      .innerJoin(
        sql`${familyMembers} as fm2`,
        sql`fm1.family_id = fm2.family_id`
      )
      .where(
        and(
          sql`fm1.user_id = ${userId}`,
          sql`fm2.user_id = ${viewerId}`
        )
      );

    if (sharedFamilies.length === 0) {
      throw new Error("You do not share any families with this user");
    }

    const sharedFamilyIds = sharedFamilies.map(f => f.familyId);

    // If familyId is provided, verify it's in the shared families
    if (familyId) {
      if (!sharedFamilyIds.includes(familyId)) {
        throw new Error("You do not share this family with this user");
      }
    }

    // Build where conditions - filter by specific family if provided, otherwise all shared families
    const whereConditions = familyId
      ? and(eq(wishlistItems.userId, userId), eq(wishlistItems.familyId, familyId))
      : and(eq(wishlistItems.userId, userId), sql`${wishlistItems.familyId} = ANY(${sharedFamilyIds})`);

    // Only return items from shared families (or specific family if provided)
    const items = await db
      .select({
        id: wishlistItems.id,
        userId: wishlistItems.userId,
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
      .leftJoin(itemPurchases, eq(wishlistItems.id, itemPurchases.itemId))
      .where(whereConditions)
      .orderBy(sql`${wishlistItems.createdAt} desc`);
    
    return items;
  }

  async getWishlistItem(id: string): Promise<WishlistItem | undefined> {
    const [item] = await db.select().from(wishlistItems).where(eq(wishlistItems.id, id));
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
        ) as items_to_purchase_count
    `);

    const row = result.rows[0] as any;
    return {
      myItemsCount: row?.my_items_count || 0,
      familyMembersCount: row?.family_members_count || 0,
      itemsToPurchaseCount: row?.items_to_purchase_count || 0,
    };
  }
}

export const storage = new DatabaseStorage();
