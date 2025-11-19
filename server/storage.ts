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
  
  // Family operations
  createFamily(family: InsertFamily): Promise<Family>;
  getFamilyByInviteCode(inviteCode: string): Promise<Family | undefined>;
  getUserFamilies(userId: string): Promise<any[]>;
  
  // Family member operations
  addFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  getFamilyMembers(userId: string): Promise<any[]>;
  getFamilyMember(familyId: string, userId: string): Promise<FamilyMember | undefined>;
  
  // Wishlist operations
  createWishlistItem(item: InsertWishlistItem): Promise<WishlistItem>;
  updateWishlistItem(id: string, item: Partial<InsertWishlistItem>): Promise<WishlistItem>;
  deleteWishlistItem(id: string): Promise<void>;
  getUserWishlistItems(userId: string): Promise<WishlistItem[]>;
  getMemberWishlistItems(userId: string, viewerId: string): Promise<any[]>;
  getWishlistItem(id: string): Promise<WishlistItem | undefined>;
  
  // Purchase operations
  markItemPurchased(purchase: InsertItemPurchase): Promise<ItemPurchase>;
  unmarkItemPurchased(itemId: string, userId: string): Promise<void>;
  getItemPurchase(itemId: string): Promise<ItemPurchase | undefined>;
  
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

  async getFamilyMember(familyId: string, userId: string): Promise<FamilyMember | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
    return member;
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
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId))
      .orderBy(sql`${wishlistItems.createdAt} desc`);
    return items;
  }

  async getMemberWishlistItems(userId: string, viewerId: string): Promise<any[]> {
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
      .where(eq(wishlistItems.userId, userId))
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

  // Stats operations
  async getUserStats(userId: string): Promise<any> {
    // Get user's family IDs
    const userFamilies = await db
      .select({ familyId: familyMembers.familyId })
      .from(familyMembers)
      .where(eq(familyMembers.userId, userId));
    
    const familyIds = userFamilies.map(f => f.familyId);
    
    if (familyIds.length === 0) {
      return {
        myItemsCount: 0,
        familyMembersCount: 0,
        itemsToPurchaseCount: 0,
      };
    }

    // Count user's own items
    const [myItemsResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlistItems)
      .where(eq(wishlistItems.userId, userId));

    // Count unique family members (excluding self)
    const [membersResult] = await db
      .select({ count: sql<number>`count(distinct ${familyMembers.userId})::int` })
      .from(familyMembers)
      .where(sql`${familyMembers.familyId} = ANY(${familyIds})`);

    // Count unpurchased items from all family members except self
    const [unpurchasedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(wishlistItems)
      .leftJoin(itemPurchases, eq(wishlistItems.id, itemPurchases.itemId))
      .where(
        and(
          sql`${wishlistItems.familyId} = ANY(${familyIds})`,
          sql`${wishlistItems.userId} != ${userId}`,
          sql`${itemPurchases.id} IS NULL`
        )
      );

    return {
      myItemsCount: myItemsResult.count,
      familyMembersCount: membersResult.count,
      itemsToPurchaseCount: unpurchasedResult.count,
    };
  }
}

export const storage = new DatabaseStorage();
