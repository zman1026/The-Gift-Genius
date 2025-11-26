import {
  users,
  families,
  familyMembers,
  wishlistItems,
  itemPurchases,
  activityLogs,
  managedProfiles,
  managedProfileGuardians,
  budgetAllocations,
  personalLists,
  personalListItems,
  personalListPurchases,
  userWishlistShares,
  managedWishlistShares,
  personalListFamilyShares,
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
  type LogOffWishlistPurchase,
  type ActivityLog,
  type InsertActivityLog,
  type ManagedProfile,
  type InsertManagedProfile,
  type ManagedProfileGuardian,
  type InsertManagedProfileGuardian,
  type PersonalList,
  type InsertPersonalList,
  type PersonalListItem,
  type InsertPersonalListItem,
  type PersonalListPurchase,
  type InsertPersonalListPurchase,
  type UserWishlistShare,
  type InsertUserWishlistShare,
  type ManagedWishlistShare,
  type InsertManagedWishlistShare,
  type PersonalListFamilyShare,
  type InsertPersonalListFamilyShare,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, sql, desc, asc, inArray } from "drizzle-orm";

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
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  
  createFamily(family: InsertFamily): Promise<Family>;
  getFamilyByInviteCode(inviteCode: string): Promise<Family | undefined>;
  getUserFamilies(userId: string): Promise<any[]>;
  getFamily(id: string): Promise<Family | undefined>;
  updateFamily(id: string, updates: Partial<InsertFamily>, requesterId: string): Promise<Family>;
  
  addFamilyMember(member: InsertFamilyMember): Promise<FamilyMember>;
  getFamilyMembers(userId: string): Promise<any[]>;
  getFamilyMember(familyId: string, userId: string): Promise<FamilyMember | undefined>;
  getFamilyMemberByManagedProfile(familyId: string, managedProfileId: string): Promise<FamilyMember | undefined>;
  updateFamilyMemberDisplayName(familyId: string, userId: string, displayName: string | null, requesterId: string): Promise<FamilyMember>;
  removeFamilyMember(familyId: string, userIdToRemove: string, requesterId: string): Promise<void>;
  leaveFamily(familyId: string, userId: string): Promise<void>;
  
  createManagedProfile(profile: InsertManagedProfile, familyId: string): Promise<ManagedProfile>;
  updateManagedProfile(id: string, updates: Partial<InsertManagedProfile>, requesterId: string): Promise<ManagedProfile>;
  deleteManagedProfile(id: string, familyId: string, requesterId: string): Promise<void>;
  getManagedProfile(id: string): Promise<ManagedProfile | undefined>;
  getManagedProfilesByCreator(createdById: string): Promise<ManagedProfile[]>;
  
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
  
  markItemPurchased(purchase: InsertItemPurchase): Promise<ItemPurchase>;
  unmarkItemPurchased(itemId: string, userId: string): Promise<void>;
  getItemPurchase(itemId: string): Promise<ItemPurchase | undefined>;
  getPurchasedItemsByUser(userId: string, familyId: string): Promise<any[]>;
  logOffWishlistPurchase(purchase: LogOffWishlistPurchase, purchasedById: string): Promise<ItemPurchase>;
  
  getUserStats(userId: string): Promise<any>;
  getUserStatsByFamily(userId: string, familyId: string): Promise<any>;
  getPurchaseTotalsByMember(userId: string, familyId: string): Promise<any[]>;
  getUserPurchaseForItem(itemId: string, userId: string): Promise<ItemPurchase | undefined>;
  getMemberItemCounts(userId: string, familyId: string): Promise<Record<string, number>>;
  getCoordinationInsights(userId: string, familyId: string): Promise<any[]>;
  
  createActivityLog(log: InsertActivityLog): Promise<ActivityLog>;
  getRecentActivities(familyId: string, limit?: number): Promise<any[]>;
  
  getBudgetOverview(familyId: string): Promise<any>;
  setBudgetAllocations(familyId: string, allocations: any[]): Promise<void>;
  getMemberGiftStatus(familyId: string, userId: string): Promise<any[]>;
  
  createPersonalList(list: InsertPersonalList): Promise<PersonalList>;
  getPersonalList(id: string): Promise<PersonalList | undefined>;
  getPersonalListBySlug(slug: string): Promise<PersonalList | undefined>;
  getUserPersonalLists(userId: string): Promise<PersonalList[]>;
  updatePersonalList(id: string, updates: Partial<InsertPersonalList>, requesterId: string): Promise<PersonalList>;
  deletePersonalList(id: string, requesterId: string): Promise<void>;
  
  createPersonalListItem(item: InsertPersonalListItem): Promise<PersonalListItem>;
  getPersonalListItems(listId: string): Promise<PersonalListItem[]>;
  getPersonalListItem(id: string): Promise<PersonalListItem | undefined>;
  updatePersonalListItem(id: string, updates: Partial<InsertPersonalListItem>, requesterId: string): Promise<PersonalListItem>;
  deletePersonalListItem(id: string, requesterId: string): Promise<void>;
  
  markPersonalListItemPurchased(itemId: string, purchasedByUserId: string): Promise<PersonalListPurchase>;
  unmarkPersonalListItemPurchased(itemId: string, requesterId: string): Promise<void>;
  getPersonalListItemPurchase(itemId: string): Promise<PersonalListPurchase | undefined>;
  getPersonalListWithItems(listId: string, viewerId?: string): Promise<any>;
  getPublicPersonalList(slug: string): Promise<any>;
  
  // Cross-family wishlist sharing
  getUserWishlistShares(userId: string): Promise<UserWishlistShare[]>;
  setUserWishlistShare(userId: string, familyId: string, sourceFamilyId: string): Promise<UserWishlistShare>;
  removeUserWishlistShare(userId: string, familyId: string, sourceFamilyId: string): Promise<void>;
  
  getManagedWishlistShares(managedProfileId: string): Promise<ManagedWishlistShare[]>;
  setManagedWishlistShare(managedProfileId: string, familyId: string, sourceFamilyId: string): Promise<ManagedWishlistShare>;
  removeManagedWishlistShare(managedProfileId: string, familyId: string, sourceFamilyId: string): Promise<void>;
  
  getPersonalListFamilyShares(listId: string): Promise<PersonalListFamilyShare[]>;
  sharePersonalListWithFamily(listId: string, familyId: string, requesterId: string): Promise<PersonalListFamilyShare>;
  unsharePersonalListFromFamily(listId: string, familyId: string, requesterId: string): Promise<void>;
  getSharedPersonalListsForFamily(familyId: string): Promise<any[]>;
  
  // Enhanced wishlist queries for cross-family visibility
  getFamilyWishlistItemsIncludingShared(familyId: string, viewerId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          id: userData.id,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
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

  async createFamily(familyData: InsertFamily): Promise<Family> {
    const [family] = await db.insert(families).values(familyData).returning();
    
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
    const [family] = await db.select().from(families).where(eq(families.id, id));
    
    if (!family) {
      throw new Error("Group not found");
    }
    
    if (family.createdById !== requesterId) {
      throw new Error("Only the group organizer can update the group");
    }
    
    const [updatedFamily] = await db
      .update(families)
      .set(updates)
      .where(eq(families.id, id))
      .returning();
    
    return updatedFamily;
  }

  async addFamilyMember(memberData: InsertFamilyMember): Promise<FamilyMember> {
    const [member] = await db.insert(familyMembers).values(memberData).returning();
    return member;
  }

  async getFamilyMembers(userId: string): Promise<any[]> {
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
    const membership = await this.getFamilyMember(familyId, requestingUserId);
    if (!membership) {
      throw new Error("You are not a member of this group");
    }

    // Include guardian permissions for the requesting user on each managed profile
    const result = await db.execute(sql`
      SELECT 
        COALESCE(u.id, mp.id) as "userId",
        mp.id as "managedProfileId",
        COALESCE(u.email, NULL) as email,
        COALESCE(u.first_name, mp.first_name) as "firstName",
        COALESCE(u.last_name, mp.last_name) as "lastName",
        COALESCE(u.profile_image_url, mp.profile_image_url) as "profileImageUrl",
        fm.display_name as "displayName",
        mp.created_by_id as "createdBy",
        CASE WHEN mp.id IS NOT NULL THEN true ELSE false END as "isManagedProfile",
        COUNT(DISTINCT wi.id)::int as "itemCount",
        COALESCE(mpg.can_edit, false) as "guardianCanEdit",
        COALESCE(mpg.can_manage_budget, false) as "guardianCanManageBudget",
        CASE WHEN mpg.guardian_user_id IS NOT NULL THEN true ELSE false END as "isGuardian"
      FROM family_members fm
      LEFT JOIN users u ON fm.user_id = u.id
      LEFT JOIN managed_profiles mp ON fm.managed_profile_id = mp.id
      LEFT JOIN managed_profile_guardians mpg ON mp.id = mpg.managed_profile_id AND mpg.guardian_user_id = ${requestingUserId}
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
        fm.display_name,
        mpg.can_edit,
        mpg.can_manage_budget,
        mpg.guardian_user_id
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

  async getFamilyMemberByManagedProfile(familyId: string, managedProfileId: string): Promise<FamilyMember | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.managedProfileId, managedProfileId)));
    return member;
  }

  async getFamilyMemberByAnyId(familyId: string, memberId: string): Promise<{ member: FamilyMember; matchedField: 'userId' | 'managedProfileId' } | undefined> {
    const [member] = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          or(
            eq(familyMembers.userId, memberId),
            eq(familyMembers.managedProfileId, memberId)
          )
        )
      );
    
    if (!member) {
      return undefined;
    }

    if (member.userId === memberId) {
      return { member, matchedField: 'userId' };
    } else if (member.managedProfileId === memberId) {
      return { member, matchedField: 'managedProfileId' };
    }

    return undefined;
  }

  async getFamilyMembersByFamilyId(familyId: string): Promise<Array<{ userId: string | null; managedProfileId: string | null }>> {
    const members = await db
      .select({
        userId: familyMembers.userId,
        managedProfileId: familyMembers.managedProfileId,
      })
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));
    
    return members;
  }

  async updateFamilyMemberDisplayName(familyId: string, userId: string, displayName: string | null, requesterId: string): Promise<FamilyMember> {
    const [family] = await db.select().from(families).where(eq(families.id, familyId));
    
    if (!family) {
      throw new Error("Group not found");
    }
    
    if (family.createdById !== requesterId) {
      throw new Error("Only the group organizer can update member display names");
    }
    
    const [member] = await db
      .update(familyMembers)
      .set({ displayName })
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)))
      .returning();
    
    if (!member) {
      throw new Error("Group member not found");
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
      throw new Error("Group member not found");
    }
    
    return member;
  }

  async removeFamilyMember(familyId: string, userIdToRemove: string, requesterId: string): Promise<void> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId));
    
    if (!family) {
      throw new Error("Group not found");
    }
    
    if (family.createdById !== requesterId) {
      throw new Error("Only the group organizer can remove members");
    }
    
    if (requesterId === userIdToRemove) {
      throw new Error("Use leave group to remove yourself");
    }
    
    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userIdToRemove)));
  }

  async leaveFamily(familyId: string, userId: string): Promise<void> {
    const [family] = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId));
    
    if (!family) {
      throw new Error("Group not found");
    }
    
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.familyId, familyId));
    
    if (family.createdById === userId && members.length === 1) {
      await db.delete(families).where(eq(families.id, familyId));
      return;
    }
    
    if (family.createdById === userId && members.length > 1) {
      throw new Error("As the group organizer, you must transfer ownership or remove all other members before leaving");
    }
    
    await db
      .delete(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.userId, userId)));
  }

  async createManagedProfile(profileData: InsertManagedProfile, familyId: string): Promise<ManagedProfile> {
    const membership = await this.getFamilyMember(familyId, profileData.createdById);
    if (!membership) {
      throw new AuthorizationError("You must be a member of the group to create a child profile");
    }

    const [profile] = await db.insert(managedProfiles).values(profileData).returning();
    
    // Create primary guardian entry for the creator
    await db.insert(managedProfileGuardians).values({
      managedProfileId: profile.id,
      guardianUserId: profileData.createdById,
      isPrimary: true,
      canEdit: true,
      canManageBudget: true,
    });
    
    await db.insert(familyMembers).values({
      familyId,
      managedProfileId: profile.id,
      userId: null,
    });
    
    return profile;
  }

  async updateManagedProfile(id: string, updates: Partial<InsertManagedProfile>, requesterId: string): Promise<ManagedProfile> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, id));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Check if requester is the creator or a guardian with edit permissions
    const isCreator = profile.createdById === requesterId;
    const guardianEntry = await this.getManagedProfileGuardian(id, requesterId);
    const canEdit = isCreator || (guardianEntry && guardianEntry.canEdit);
    
    if (!canEdit) {
      throw new AuthorizationError("You don't have permission to edit this child profile");
    }
    
    const [updatedProfile] = await db
      .update(managedProfiles)
      .set(updates)
      .where(eq(managedProfiles.id, id))
      .returning();
    
    return updatedProfile;
  }

  async deleteManagedProfile(id: string, familyId: string, requesterId: string): Promise<void> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, id));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Only the primary creator can delete the profile
    if (profile.createdById !== requesterId) {
      throw new AuthorizationError("Only the primary guardian can delete this child profile");
    }
    
    await db.delete(managedProfiles).where(eq(managedProfiles.id, id));
  }
  
  // Guardian management methods
  async getManagedProfileGuardian(profileId: string, userId: string): Promise<ManagedProfileGuardian | undefined> {
    const [guardian] = await db
      .select()
      .from(managedProfileGuardians)
      .where(and(
        eq(managedProfileGuardians.managedProfileId, profileId),
        eq(managedProfileGuardians.guardianUserId, userId)
      ));
    return guardian;
  }
  
  async getManagedProfileGuardians(profileId: string): Promise<(ManagedProfileGuardian & { guardian: User })[]> {
    const guardians = await db
      .select({
        id: managedProfileGuardians.id,
        managedProfileId: managedProfileGuardians.managedProfileId,
        guardianUserId: managedProfileGuardians.guardianUserId,
        isPrimary: managedProfileGuardians.isPrimary,
        canEdit: managedProfileGuardians.canEdit,
        canManageBudget: managedProfileGuardians.canManageBudget,
        addedAt: managedProfileGuardians.addedAt,
        guardian: users,
      })
      .from(managedProfileGuardians)
      .innerJoin(users, eq(managedProfileGuardians.guardianUserId, users.id))
      .where(eq(managedProfileGuardians.managedProfileId, profileId));
    return guardians;
  }
  
  async addGuardianToManagedProfile(
    profileId: string, 
    guardianUserId: string, 
    requesterId: string,
    permissions?: { canEdit?: boolean; canManageBudget?: boolean }
  ): Promise<ManagedProfileGuardian> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, profileId));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Only the primary creator can add guardians
    if (profile.createdById !== requesterId) {
      throw new AuthorizationError("Only the primary guardian can add other guardians");
    }
    
    // Check if guardian is already added
    const existing = await this.getManagedProfileGuardian(profileId, guardianUserId);
    if (existing) {
      throw new Error("This user is already a guardian for this profile");
    }
    
    const [guardian] = await db.insert(managedProfileGuardians).values({
      managedProfileId: profileId,
      guardianUserId,
      isPrimary: false,
      canEdit: permissions?.canEdit ?? true,
      canManageBudget: permissions?.canManageBudget ?? false,
    }).returning();
    
    return guardian;
  }
  
  async updateGuardianPermissions(
    profileId: string,
    guardianUserId: string,
    requesterId: string,
    permissions: { canEdit?: boolean; canManageBudget?: boolean }
  ): Promise<ManagedProfileGuardian> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, profileId));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Only the primary creator can update permissions
    if (profile.createdById !== requesterId) {
      throw new AuthorizationError("Only the primary guardian can modify guardian permissions");
    }
    
    const [updated] = await db
      .update(managedProfileGuardians)
      .set(permissions)
      .where(and(
        eq(managedProfileGuardians.managedProfileId, profileId),
        eq(managedProfileGuardians.guardianUserId, guardianUserId)
      ))
      .returning();
    
    if (!updated) {
      throw new NotFoundError("Guardian not found for this profile");
    }
    
    return updated;
  }
  
  async removeGuardianFromManagedProfile(profileId: string, guardianUserId: string, requesterId: string): Promise<void> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, profileId));
    
    if (!profile) {
      throw new NotFoundError("Managed profile not found");
    }
    
    // Only the primary creator can remove guardians
    if (profile.createdById !== requesterId) {
      throw new AuthorizationError("Only the primary guardian can remove other guardians");
    }
    
    // Cannot remove the primary guardian
    if (guardianUserId === profile.createdById) {
      throw new Error("Cannot remove the primary guardian");
    }
    
    await db
      .delete(managedProfileGuardians)
      .where(and(
        eq(managedProfileGuardians.managedProfileId, profileId),
        eq(managedProfileGuardians.guardianUserId, guardianUserId)
      ));
  }
  
  async getManagedProfilesByGuardian(guardianUserId: string): Promise<ManagedProfile[]> {
    // Get profiles where user is creator OR is a guardian
    const profiles = await db
      .selectDistinct({ profile: managedProfiles })
      .from(managedProfiles)
      .leftJoin(managedProfileGuardians, eq(managedProfiles.id, managedProfileGuardians.managedProfileId))
      .where(or(
        eq(managedProfiles.createdById, guardianUserId),
        eq(managedProfileGuardians.guardianUserId, guardianUserId)
      ));
    return profiles.map(p => p.profile);
  }
  
  async isGuardianOfProfile(profileId: string, userId: string): Promise<boolean> {
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, profileId));
    
    if (!profile) return false;
    
    // Check if user is the creator
    if (profile.createdById === userId) return true;
    
    // Check if user is a guardian
    const guardian = await this.getManagedProfileGuardian(profileId, userId);
    return !!guardian;
  }

  async getGuardianPermissions(profileId: string, userId: string): Promise<{ canEdit: boolean; canManageBudget: boolean } | null> {
    // Check if user is the creator (has all permissions)
    const [profile] = await db
      .select()
      .from(managedProfiles)
      .where(eq(managedProfiles.id, profileId));
    
    if (!profile) return null;
    
    // Creator has all permissions
    if (profile.createdById === userId) {
      return { canEdit: true, canManageBudget: true };
    }
    
    // Check guardian permissions
    const guardian = await this.getManagedProfileGuardian(profileId, userId);
    if (!guardian) return null;
    
    return {
      canEdit: guardian.canEdit ?? false,
      canManageBudget: guardian.canManageBudget ?? false
    };
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
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new AuthorizationError("You are not a member of this group");
    }

    const items = await db
      .select()
      .from(wishlistItems)
      .where(and(
        inArray(wishlistItems.id, itemIds),
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.familyId, familyId)
      ));

    if (items.length < itemIds.length) {
      const foundIds = new Set(items.map(item => item.id));
      const missingIds = itemIds.filter(id => !foundIds.has(id));
      throw new AuthorizationError(`Cannot delete ${missingIds.length} item(s): not found or unauthorized`);
    }

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
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new AuthorizationError("You are not a member of this group");
    }

    const existingItems = await db
      .select()
      .from(wishlistItems)
      .where(and(
        inArray(wishlistItems.id, itemIds),
        eq(wishlistItems.userId, userId),
        eq(wishlistItems.familyId, familyId)
      ));

    if (existingItems.length < itemIds.length) {
      const foundIds = new Set(existingItems.map(item => item.id));
      const missingIds = itemIds.filter(id => !foundIds.has(id));
      throw new AuthorizationError(`Cannot update ${missingIds.length} item(s): not found or unauthorized`);
    }

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
    const whereConditions = [eq(wishlistItems.userId, userId)];
    
    if (options?.priority) {
      whereConditions.push(eq(wishlistItems.priority, options.priority));
    }
    
    if (options?.itemType) {
      whereConditions.push(eq(wishlistItems.itemType, options.itemType));
    }
    
    const orderByClauses = [];
    const orderDirection = options?.order === 'asc' ? asc : desc;
    
    switch (options?.sort) {
      case 'name':
        orderByClauses.push(orderDirection(sql`LOWER(${wishlistItems.name})`));
        orderByClauses.push(desc(wishlistItems.createdAt));
        break;
      case 'price':
        if (options?.order === 'asc') {
          orderByClauses.push(sql`${wishlistItems.price} ASC NULLS LAST`);
        } else {
          orderByClauses.push(sql`${wishlistItems.price} DESC NULLS LAST`);
        }
        orderByClauses.push(desc(wishlistItems.createdAt));
        break;
      case 'priority':
        orderByClauses.push(sql`CASE ${wishlistItems.priority} 
          WHEN 'low' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'high' THEN 3 
          ELSE 0
          END ${options?.order === 'asc' ? sql`ASC` : sql`DESC`}`);
        orderByClauses.push(desc(wishlistItems.createdAt));
        break;
      case 'createdAt':
      default:
        orderByClauses.push(orderDirection(wishlistItems.createdAt));
        break;
    }
    
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
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this group");
    }

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
    
    const orderByClauses = [];
    const orderDirection = options?.order === 'asc' ? asc : desc;
    
    switch (options?.sort) {
      case 'name':
        orderByClauses.push(orderDirection(sql`LOWER(${wishlistItems.name})`));
        orderByClauses.push(desc(wishlistItems.createdAt));
        break;
      case 'price':
        if (options?.order === 'asc') {
          orderByClauses.push(sql`${wishlistItems.price} ASC NULLS LAST`);
        } else {
          orderByClauses.push(sql`${wishlistItems.price} DESC NULLS LAST`);
        }
        orderByClauses.push(desc(wishlistItems.createdAt));
        break;
      case 'priority':
        orderByClauses.push(sql`CASE ${wishlistItems.priority} 
          WHEN 'low' THEN 1 
          WHEN 'medium' THEN 2 
          WHEN 'high' THEN 3 
          ELSE 0
          END ${options?.order === 'asc' ? sql`ASC` : sql`DESC`}`);
        orderByClauses.push(desc(wishlistItems.createdAt));
        break;
      case 'createdAt':
      default:
        orderByClauses.push(orderDirection(wishlistItems.createdAt));
        break;
    }
    
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
      throw new Error("You do not share any groups with this member");
    }

    const sharedFamilyIds = sharedFamilies.map(f => f.familyId);

    if (familyId) {
      if (!sharedFamilyIds.includes(familyId)) {
        throw new Error("You do not share this group with this member");
      }
    }

    const memberCondition = isUserId 
      ? eq(wishlistItems.userId, memberId)
      : eq(wishlistItems.managedProfileId, memberId);
    
    const familyCondition = familyId
      ? eq(wishlistItems.familyId, familyId)
      : inArray(wishlistItems.familyId, sharedFamilyIds);

    const conditions = [memberCondition, familyCondition];
    const whereConditions = and(...conditions);

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
    if (!url && !productId) {
      return undefined;
    }

    const conditions = [
      eq(wishlistItems.userId, userId),
      eq(wishlistItems.familyId, familyId)
    ];
    
    const baseConditions = and(...conditions);

    const matchConditions = [];
    
    if (url) {
      matchConditions.push(sql`LOWER(${wishlistItems.url}) = LOWER(${url})`);
    }
    
    if (productId) {
      matchConditions.push(eq(wishlistItems.productId, productId));
    }

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

  async logOffWishlistPurchase(purchase: LogOffWishlistPurchase, purchasedById: string): Promise<ItemPurchase> {
    const membership = await this.getFamilyMember(purchase.familyId, purchasedById);
    if (!membership) {
      throw new AuthorizationError("You must be a member of the group to log purchases");
    }

    if (purchase.recipientUserId) {
      const recipientMembership = await this.getFamilyMember(purchase.familyId, purchase.recipientUserId);
      if (!recipientMembership) {
        throw new AuthorizationError("Recipient must be a member of the group");
      }
    } else if (purchase.recipientManagedProfileId) {
      const managedProfile = await this.getManagedProfile(purchase.recipientManagedProfileId);
      if (!managedProfile) {
        throw new NotFoundError("Managed profile not found");
      }
      const creatorMembership = await this.getFamilyMember(purchase.familyId, managedProfile.createdById);
      if (!creatorMembership) {
        throw new AuthorizationError("Managed profile must belong to a group member");
      }
    }

    const [newPurchase] = await db
      .insert(itemPurchases)
      .values({
        familyId: purchase.familyId,
        purchasedById,
        recipientUserId: purchase.recipientUserId || null,
        recipientManagedProfileId: purchase.recipientManagedProfileId || null,
        price: purchase.price.toString(),
        description: purchase.description,
        purchasedFrom: purchase.purchasedFrom || null,
        notes: purchase.notes || null,
        itemId: null,
      })
      .returning();

    return newPurchase;
  }

  async getPurchasedItemsByUser(userId: string, familyId: string): Promise<any[]> {
    const conditions = [
      eq(itemPurchases.familyId, familyId),
      eq(itemPurchases.purchasedById, userId)
    ];

    const purchases = await db
      .select({
        id: itemPurchases.id,
        itemId: itemPurchases.itemId,
        familyId: itemPurchases.familyId,
        notes: itemPurchases.notes,
        purchasedAt: itemPurchases.purchasedAt,
        price: itemPurchases.price,
        description: itemPurchases.description,
        purchasedFrom: itemPurchases.purchasedFrom,
        recipientUserId: itemPurchases.recipientUserId,
        recipientManagedProfileId: itemPurchases.recipientManagedProfileId,
        itemSnapshot: itemPurchases.itemSnapshot,
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
          managedProfileId: wishlistItems.managedProfileId,
        },
        recipientUser: {
          id: sql<string>`ru.id`,
          email: sql<string>`ru.email`,
          firstName: sql<string>`ru.first_name`,
          lastName: sql<string>`ru.last_name`,
          profileImageUrl: sql<string>`ru.profile_image_url`,
        },
        recipientManagedProfile: {
          id: sql<string>`rmp.id`,
          displayName: sql<string>`COALESCE(rmp.first_name || ' ' || rmp.last_name, rmp.first_name)`,
          profileImageUrl: sql<string>`rmp.profile_image_url`,
        },
      })
      .from(itemPurchases)
      .leftJoin(wishlistItems, eq(itemPurchases.itemId, wishlistItems.id))
      .leftJoin(sql`users ru`, sql`${itemPurchases.recipientUserId} = ru.id`)
      .leftJoin(sql`managed_profiles rmp`, sql`${itemPurchases.recipientManagedProfileId} = rmp.id`)
      .where(and(...conditions))
      .orderBy(desc(itemPurchases.purchasedAt));

    return purchases;
  }

  async getUserStats(userId: string): Promise<any> {
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
      groupMembersCount: row?.family_members_count || 0,
      itemsToPurchaseCount: row?.items_to_purchase_count || 0,
    };
  }

  async getUserStatsByFamily(userId: string, familyId: string): Promise<any> {
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this group");
    }

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
          SELECT COALESCE(SUM(COALESCE(wi.price, 0)), 0)::text
          FROM ${itemPurchases} ip
          INNER JOIN ${wishlistItems} wi ON ip.item_id = wi.id
          WHERE ip.purchased_by_id = ${userId}
          AND wi.family_id = ${familyId}
        ) as total_purchased
    `);

    const row = result.rows[0] as any;
    return {
      myItemsCount: row?.my_items_count || 0,
      groupMembersCount: row?.family_members_count || 0,
      itemsToPurchaseCount: row?.items_to_purchase_count || 0,
      totalPurchased: parseFloat(row?.total_purchased || '0'),
    };
  }

  async getPurchaseTotalsByMember(userId: string, familyId: string) {
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this group");
    }

    const result = await db.execute(sql`
      SELECT 
        wi.user_id,
        COALESCE(SUM(COALESCE(wi.price, 0)), 0)::text as total_spent,
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

  async getMemberItemCounts(userId: string, familyId: string): Promise<Record<string, number>> {
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this group");
    }

    const result = await db.execute(sql`
      SELECT 
        COALESCE(wi.user_id, wi.managed_profile_id) as member_id,
        COUNT(*)::int as item_count
      FROM ${wishlistItems} wi
      WHERE wi.family_id = ${familyId}
      GROUP BY COALESCE(wi.user_id, wi.managed_profile_id)
    `);

    const counts: Record<string, number> = {};
    for (const row of result.rows as any[]) {
      if (row.member_id) {
        counts[row.member_id] = row.item_count || 0;
      }
    }

    return counts;
  }

  async getCoordinationInsights(userId: string, familyId: string): Promise<any[]> {
    const membership = await this.getFamilyMember(familyId, userId);
    if (!membership) {
      throw new Error("You are not a member of this group");
    }

    const insights: any[] = [];

    const highPriorityResult = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM ${wishlistItems} wi
      LEFT JOIN ${itemPurchases} ip ON wi.id = ip.item_id
      WHERE wi.family_id = ${familyId}
      AND wi.user_id != ${userId}
      AND wi.priority = 'high'
      AND ip.id IS NULL
    `);

    const highPriorityCount = (highPriorityResult.rows[0] as any)?.count || 0;
    if (highPriorityCount > 0) {
      insights.push({
        type: "high-priority",
        message: `${highPriorityCount} high-priority ${highPriorityCount === 1 ? 'item needs' : 'items need'} gifts`,
        count: highPriorityCount,
      });
    }

    const membersWithNoGiftsResult = await db.execute(sql`
      SELECT 
        fm.user_id,
        fm.managed_profile_id,
        fm.display_name,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        mp.first_name as profile_first_name,
        mp.last_name as profile_last_name,
        COUNT(wi.id)::int as total_items,
        COUNT(ip.id)::int as purchased_items
      FROM ${familyMembers} fm
      LEFT JOIN ${users} u ON fm.user_id = u.id
      LEFT JOIN ${managedProfiles} mp ON fm.managed_profile_id = mp.id
      LEFT JOIN ${wishlistItems} wi ON (wi.user_id = fm.user_id OR wi.managed_profile_id = fm.managed_profile_id)
        AND wi.family_id = ${familyId}
      LEFT JOIN ${itemPurchases} ip ON wi.id = ip.item_id
      WHERE fm.family_id = ${familyId}
      AND (fm.user_id != ${userId} OR fm.user_id IS NULL)
      GROUP BY fm.id, fm.user_id, fm.managed_profile_id, fm.display_name, 
               u.first_name, u.last_name, mp.first_name, mp.last_name
      HAVING COUNT(wi.id) > 0 AND COUNT(ip.id) = 0
      LIMIT 2
    `);

    for (const row of membersWithNoGiftsResult.rows as any[]) {
      const memberName = row.display_name || 
        (row.user_first_name ? `${row.user_first_name} ${row.user_last_name || ''}`.trim() : '') ||
        (row.profile_first_name ? `${row.profile_first_name} ${row.profile_last_name || ''}`.trim() : '');
      
      insights.push({
        type: "no-gifts",
        message: `${memberName} has ${row.total_items} ${row.total_items === 1 ? 'item' : 'items'} but no gifts purchased yet`,
        memberId: row.user_id || row.managed_profile_id,
        memberName,
      });
    }

    const personalProgressResult = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM ${itemPurchases} ip
      INNER JOIN ${wishlistItems} wi ON ip.item_id = wi.id
      WHERE ip.purchased_by_id = ${userId}
      AND wi.family_id = ${familyId}
    `);

    const purchasedCount = (personalProgressResult.rows[0] as any)?.count || 0;
    if (purchasedCount > 0) {
      insights.push({
        type: "personal-progress",
        message: `You've marked ${purchasedCount} ${purchasedCount === 1 ? 'gift' : 'gifts'} as purchased`,
        count: purchasedCount,
      });
    }

    return insights;
  }

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

  async getBudgetOverview(familyId: string): Promise<any> {
    const family = await this.getFamily(familyId);
    if (!family) {
      throw new Error("Group not found");
    }

    const membersQuery = await db
      .select({
        userId: familyMembers.userId,
        managedProfileId: familyMembers.managedProfileId,
        displayName: familyMembers.displayName,
        firstName: sql<string>`COALESCE(${users.firstName}, ${managedProfiles.firstName})`,
        lastName: sql<string>`COALESCE(${users.lastName}, ${managedProfiles.lastName})`,
        profileImageUrl: sql<string>`COALESCE(${users.profileImageUrl}, ${managedProfiles.profileImageUrl})`,
      })
      .from(familyMembers)
      .leftJoin(users, eq(familyMembers.userId, users.id))
      .leftJoin(managedProfiles, eq(familyMembers.managedProfileId, managedProfiles.id))
      .where(eq(familyMembers.familyId, familyId));

    const allocations = await db
      .select()
      .from(budgetAllocations)
      .where(eq(budgetAllocations.familyId, familyId));

    const spendingQuery = await db
      .select({
        recipientUserId: sql<string>`COALESCE(${wishlistItems.userId}, ${itemPurchases.recipientUserId})`,
        recipientManagedProfileId: sql<string>`COALESCE(${wishlistItems.managedProfileId}, ${itemPurchases.recipientManagedProfileId})`,
        totalSpent: sql<number>`COALESCE(SUM(CAST(COALESCE(${wishlistItems.price}, ${itemPurchases.price}) AS NUMERIC)), 0)`,
      })
      .from(itemPurchases)
      .leftJoin(wishlistItems, eq(wishlistItems.id, itemPurchases.itemId))
      .where(eq(itemPurchases.familyId, familyId))
      .groupBy(
        sql`COALESCE(${wishlistItems.userId}, ${itemPurchases.recipientUserId})`,
        sql`COALESCE(${wishlistItems.managedProfileId}, ${itemPurchases.recipientManagedProfileId})`
      );

    const spendingMap = new Map<string, number>();
    for (const row of spendingQuery) {
      const key = row.recipientUserId || row.recipientManagedProfileId || '';
      if (key) {
        spendingMap.set(key, Number(row.totalSpent));
      }
    }

    const allocationMap = new Map<string, number>();
    for (const allocation of allocations) {
      const key = allocation.userId || allocation.managedProfileId || '';
      allocationMap.set(key, parseFloat(allocation.allocatedAmount));
    }

    const memberBudgets = membersQuery.map(member => {
      const key = member.userId || member.managedProfileId || '';
      const allocated = allocationMap.get(key) || 0;
      const spent = spendingMap.get(key) || 0;
      const remaining = allocated - spent;
      const percentUsed = allocated > 0 ? (spent / allocated) * 100 : 0;

      let status: 'good' | 'warning' | 'over' = 'good';
      if (percentUsed >= 100) {
        status = 'over';
      } else if (percentUsed >= 80) {
        status = 'warning';
      }

      return {
        userId: member.userId,
        managedProfileId: member.managedProfileId,
        displayName: member.displayName || `${member.firstName} ${member.lastName || ''}`.trim(),
        firstName: member.firstName,
        lastName: member.lastName,
        profileImageUrl: member.profileImageUrl,
        allocated,
        spent,
        remaining,
        percentUsed,
        status,
      };
    });

    const totalAllocated = memberBudgets.reduce((sum, m) => sum + m.allocated, 0);
    const totalSpent = memberBudgets.reduce((sum, m) => sum + m.spent, 0);
    const totalRemaining = totalAllocated - totalSpent;

    return {
      family,
      totalAllocated,
      totalSpent,
      totalRemaining,
      memberBudgets,
    };
  }

  async setBudgetAllocations(familyId: string, allocations: any[]): Promise<void> {
    for (const allocation of allocations) {
      const amount = parseFloat(allocation.allocatedAmount);
      if (isNaN(amount) || amount < 0) {
        throw new Error("Invalid allocation amount: must be a non-negative number");
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(budgetAllocations).where(eq(budgetAllocations.familyId, familyId));

      if (allocations.length > 0) {
        await tx.insert(budgetAllocations).values(
          allocations.map(allocation => ({
            familyId,
            userId: allocation.userId || null,
            managedProfileId: allocation.managedProfileId || null,
            allocatedAmount: allocation.allocatedAmount.toString(),
          }))
        );
      }
    });
  }

  async getMemberGiftStatus(familyId: string, userId: string): Promise<any[]> {
    // Get all members in the family (excluding the current user)
    const familyMembersData = await this.getFamilyMembersByFamilyId(familyId);
    
    const result: any[] = [];
    
    for (const member of familyMembersData) {
      // Skip the current user - they don't buy gifts for themselves
      if (member.userId === userId) continue;
      
      const memberId = member.userId || member.managedProfileId;
      
      // Fetch the user or managed profile data for the name
      let memberName = 'Unknown';
      if (member.managedProfileId) {
        const [profile] = await db.select().from(managedProfiles).where(eq(managedProfiles.id, member.managedProfileId));
        if (profile) memberName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Unknown';
      } else if (member.userId) {
        const [user] = await db.select().from(users).where(eq(users.id, member.userId));
        if (user) memberName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
      }
      
      // Count purchases made by the current user for this member (both wishlist and off-list)
      const purchases = await db
        .select({ count: sql<number>`count(*)` })
        .from(itemPurchases)
        .where(and(
          eq(itemPurchases.purchasedById, userId),
          eq(itemPurchases.familyId, familyId),
          or(
            member.userId ? eq(itemPurchases.recipientUserId, member.userId) : sql`false`,
            member.managedProfileId ? eq(itemPurchases.recipientManagedProfileId, member.managedProfileId) : sql`false`
          )
        ));
      
      // Also count purchases from wishlist items belonging to this member
      const wishlistPurchases = await db
        .select({ count: sql<number>`count(*)` })
        .from(itemPurchases)
        .innerJoin(wishlistItems, eq(itemPurchases.itemId, wishlistItems.id))
        .where(and(
          eq(itemPurchases.purchasedById, userId),
          eq(wishlistItems.familyId, familyId),
          member.userId ? eq(wishlistItems.userId, member.userId) : sql`false`
        ));
      
      const offListCount = Number(purchases[0]?.count || 0);
      const wishlistCount = Number(wishlistPurchases[0]?.count || 0);
      const totalGiftCount = offListCount + wishlistCount;
      
      result.push({
        memberId,
        memberName,
        hasReceivedGift: totalGiftCount > 0,
        giftCount: totalGiftCount,
      });
    }
    
    return result;
  }

  async createPersonalList(listData: InsertPersonalList): Promise<PersonalList> {
    const [list] = await db.insert(personalLists).values(listData).returning();
    return list;
  }

  async getPersonalList(id: string): Promise<PersonalList | undefined> {
    const [list] = await db.select().from(personalLists).where(eq(personalLists.id, id));
    return list;
  }

  async getPersonalListBySlug(slug: string): Promise<PersonalList | undefined> {
    const [list] = await db.select().from(personalLists).where(eq(personalLists.publicSlug, slug));
    return list;
  }

  async getUserPersonalLists(userId: string): Promise<PersonalList[]> {
    return await db
      .select()
      .from(personalLists)
      .where(eq(personalLists.userId, userId))
      .orderBy(desc(personalLists.createdAt));
  }

  async updatePersonalList(id: string, updates: Partial<InsertPersonalList>, requesterId: string): Promise<PersonalList> {
    const list = await this.getPersonalList(id);
    if (!list) {
      throw new NotFoundError("Personal list not found");
    }
    if (list.userId !== requesterId) {
      throw new AuthorizationError("You can only update your own lists");
    }
    
    const [updatedList] = await db
      .update(personalLists)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(personalLists.id, id))
      .returning();
    
    return updatedList;
  }

  async deletePersonalList(id: string, requesterId: string): Promise<void> {
    const list = await this.getPersonalList(id);
    if (!list) {
      throw new NotFoundError("Personal list not found");
    }
    if (list.userId !== requesterId) {
      throw new AuthorizationError("You can only delete your own lists");
    }
    
    await db.delete(personalLists).where(eq(personalLists.id, id));
  }

  async createPersonalListItem(itemData: InsertPersonalListItem): Promise<PersonalListItem> {
    const [item] = await db.insert(personalListItems).values(itemData).returning();
    return item;
  }

  async getPersonalListItems(listId: string): Promise<PersonalListItem[]> {
    return await db
      .select()
      .from(personalListItems)
      .where(eq(personalListItems.listId, listId))
      .orderBy(desc(personalListItems.createdAt));
  }

  async getPersonalListItem(id: string): Promise<PersonalListItem | undefined> {
    const [item] = await db.select().from(personalListItems).where(eq(personalListItems.id, id));
    return item;
  }

  async updatePersonalListItem(id: string, updates: Partial<InsertPersonalListItem>, requesterId: string): Promise<PersonalListItem> {
    const item = await this.getPersonalListItem(id);
    if (!item) {
      throw new NotFoundError("Personal list item not found");
    }
    
    const list = await this.getPersonalList(item.listId);
    if (!list || list.userId !== requesterId) {
      throw new AuthorizationError("You can only update items in your own lists");
    }
    
    const [updatedItem] = await db
      .update(personalListItems)
      .set(updates)
      .where(eq(personalListItems.id, id))
      .returning();
    
    return updatedItem;
  }

  async deletePersonalListItem(id: string, requesterId: string): Promise<void> {
    const item = await this.getPersonalListItem(id);
    if (!item) {
      throw new NotFoundError("Personal list item not found");
    }
    
    const list = await this.getPersonalList(item.listId);
    if (!list || list.userId !== requesterId) {
      throw new AuthorizationError("You can only delete items from your own lists");
    }
    
    await db.delete(personalListItems).where(eq(personalListItems.id, id));
  }

  async markPersonalListItemPurchased(itemId: string, purchasedByUserId: string): Promise<PersonalListPurchase> {
    const item = await this.getPersonalListItem(itemId);
    if (!item) {
      throw new NotFoundError("Personal list item not found");
    }
    
    const list = await this.getPersonalList(item.listId);
    if (list && list.userId === purchasedByUserId) {
      throw new AuthorizationError("You cannot mark items on your own list as purchased");
    }
    
    const existingPurchase = await this.getPersonalListItemPurchase(itemId);
    if (existingPurchase) {
      throw new Error("This item has already been purchased");
    }
    
    const [purchase] = await db
      .insert(personalListPurchases)
      .values({ itemId, purchasedByUserId })
      .returning();
    
    return purchase;
  }

  async unmarkPersonalListItemPurchased(itemId: string, requesterId: string): Promise<void> {
    const purchase = await this.getPersonalListItemPurchase(itemId);
    if (!purchase) {
      throw new NotFoundError("Purchase record not found");
    }
    
    if (purchase.purchasedByUserId !== requesterId) {
      throw new AuthorizationError("You can only unmark items you purchased");
    }
    
    await db.delete(personalListPurchases).where(eq(personalListPurchases.itemId, itemId));
  }

  async getPersonalListItemPurchase(itemId: string): Promise<PersonalListPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(personalListPurchases)
      .where(eq(personalListPurchases.itemId, itemId));
    return purchase;
  }

  async getPersonalListWithItems(listId: string, viewerId?: string): Promise<any> {
    const list = await this.getPersonalList(listId);
    if (!list) {
      throw new NotFoundError("Personal list not found");
    }
    
    const items = await this.getPersonalListItems(listId);
    const isOwner = viewerId && list.userId === viewerId;
    
    const owner = await this.getUser(list.userId);
    
    const itemsWithPurchases = await Promise.all(
      items.map(async (item) => {
        const purchase = await this.getPersonalListItemPurchase(item.id);
        
        if (isOwner) {
          return { ...item, isPurchased: false, isPurchasedByViewer: false };
        }
        
        const isPurchasedByViewer = !!(purchase && viewerId && purchase.purchasedByUserId === viewerId);
        return {
          ...item,
          isPurchased: !!purchase,
          isPurchasedByViewer,
        };
      })
    );
    
    return {
      ...list,
      owner: owner ? {
        id: owner.id,
        firstName: owner.firstName,
        lastName: owner.lastName,
        profileImageUrl: owner.profileImageUrl,
      } : null,
      items: itemsWithPurchases,
      isOwner,
    };
  }

  async getPublicPersonalList(slug: string): Promise<any> {
    const list = await this.getPersonalListBySlug(slug);
    if (!list) {
      throw new NotFoundError("Personal list not found");
    }
    
    const items = await this.getPersonalListItems(list.id);
    const owner = await this.getUser(list.userId);
    
    const itemsWithStatus = await Promise.all(
      items.map(async (item) => {
        const purchase = await this.getPersonalListItemPurchase(item.id);
        return {
          ...item,
          isPurchased: !!purchase,
        };
      })
    );
    
    return {
      ...list,
      owner: owner ? {
        firstName: owner.firstName,
        lastName: owner.lastName,
        profileImageUrl: owner.profileImageUrl,
      } : null,
      items: itemsWithStatus,
    };
  }

  // ============================================
  // Cross-Family Wishlist Sharing Methods
  // ============================================

  async getUserWishlistShares(userId: string): Promise<UserWishlistShare[]> {
    const shares = await db
      .select()
      .from(userWishlistShares)
      .where(eq(userWishlistShares.userId, userId));
    return shares;
  }

  async setUserWishlistShare(userId: string, familyId: string, sourceFamilyId: string): Promise<UserWishlistShare> {
    const [share] = await db
      .insert(userWishlistShares)
      .values({ userId, familyId, sourceFamilyId })
      .onConflictDoNothing()
      .returning();
    
    if (!share) {
      const [existing] = await db
        .select()
        .from(userWishlistShares)
        .where(and(
          eq(userWishlistShares.userId, userId),
          eq(userWishlistShares.familyId, familyId),
          eq(userWishlistShares.sourceFamilyId, sourceFamilyId)
        ));
      return existing;
    }
    return share;
  }

  async removeUserWishlistShare(userId: string, familyId: string, sourceFamilyId: string): Promise<void> {
    await db
      .delete(userWishlistShares)
      .where(and(
        eq(userWishlistShares.userId, userId),
        eq(userWishlistShares.familyId, familyId),
        eq(userWishlistShares.sourceFamilyId, sourceFamilyId)
      ));
  }

  async getManagedWishlistShares(managedProfileId: string): Promise<ManagedWishlistShare[]> {
    const shares = await db
      .select()
      .from(managedWishlistShares)
      .where(eq(managedWishlistShares.managedProfileId, managedProfileId));
    return shares;
  }

  async setManagedWishlistShare(managedProfileId: string, familyId: string, sourceFamilyId: string): Promise<ManagedWishlistShare> {
    const [share] = await db
      .insert(managedWishlistShares)
      .values({ managedProfileId, familyId, sourceFamilyId })
      .onConflictDoNothing()
      .returning();
    
    if (!share) {
      const [existing] = await db
        .select()
        .from(managedWishlistShares)
        .where(and(
          eq(managedWishlistShares.managedProfileId, managedProfileId),
          eq(managedWishlistShares.familyId, familyId),
          eq(managedWishlistShares.sourceFamilyId, sourceFamilyId)
        ));
      return existing;
    }
    return share;
  }

  async removeManagedWishlistShare(managedProfileId: string, familyId: string, sourceFamilyId: string): Promise<void> {
    await db
      .delete(managedWishlistShares)
      .where(and(
        eq(managedWishlistShares.managedProfileId, managedProfileId),
        eq(managedWishlistShares.familyId, familyId),
        eq(managedWishlistShares.sourceFamilyId, sourceFamilyId)
      ));
  }

  async getPersonalListFamilyShares(listId: string): Promise<PersonalListFamilyShare[]> {
    const shares = await db
      .select()
      .from(personalListFamilyShares)
      .where(eq(personalListFamilyShares.listId, listId));
    return shares;
  }

  async sharePersonalListWithFamily(listId: string, familyId: string, requesterId: string): Promise<PersonalListFamilyShare> {
    const list = await this.getPersonalList(listId);
    if (!list) {
      throw new NotFoundError("Personal list not found");
    }
    if (list.userId !== requesterId) {
      throw new AuthorizationError("Only the list owner can share this list");
    }
    
    const [share] = await db
      .insert(personalListFamilyShares)
      .values({ listId, familyId })
      .onConflictDoNothing()
      .returning();
    
    if (!share) {
      const [existing] = await db
        .select()
        .from(personalListFamilyShares)
        .where(and(
          eq(personalListFamilyShares.listId, listId),
          eq(personalListFamilyShares.familyId, familyId)
        ));
      return existing;
    }
    return share;
  }

  async unsharePersonalListFromFamily(listId: string, familyId: string, requesterId: string): Promise<void> {
    const list = await this.getPersonalList(listId);
    if (!list) {
      throw new NotFoundError("Personal list not found");
    }
    if (list.userId !== requesterId) {
      throw new AuthorizationError("Only the list owner can unshare this list");
    }
    
    await db
      .delete(personalListFamilyShares)
      .where(and(
        eq(personalListFamilyShares.listId, listId),
        eq(personalListFamilyShares.familyId, familyId)
      ));
  }

  async getSharedPersonalListsForFamily(familyId: string): Promise<any[]> {
    const shares = await db
      .select({
        share: personalListFamilyShares,
        list: personalLists,
      })
      .from(personalListFamilyShares)
      .innerJoin(personalLists, eq(personalListFamilyShares.listId, personalLists.id))
      .where(eq(personalListFamilyShares.familyId, familyId));
    
    const listsWithOwners = await Promise.all(
      shares.map(async ({ share, list }) => {
        const owner = await this.getUser(list.userId);
        const items = await this.getPersonalListItems(list.id);
        const itemCount = items.length;
        
        return {
          ...list,
          sharedAt: share.createdAt,
          owner: owner ? {
            id: owner.id,
            firstName: owner.firstName,
            lastName: owner.lastName,
            profileImageUrl: owner.profileImageUrl,
          } : null,
          itemCount,
        };
      })
    );
    
    return listsWithOwners;
  }

  async getFamilyWishlistItemsIncludingShared(familyId: string, viewerId: string): Promise<any[]> {
    const familyMembers = await this.getFamilyMembersByFamily(familyId, viewerId);
    
    const userShares = await db
      .select()
      .from(userWishlistShares)
      .where(eq(userWishlistShares.familyId, familyId));
    
    const managedShares = await db
      .select()
      .from(managedWishlistShares)
      .where(eq(managedWishlistShares.familyId, familyId));
    
    const nativeItems = await db
      .select()
      .from(wishlistItems)
      .where(eq(wishlistItems.familyId, familyId));
    
    const sharedUserItems = await Promise.all(
      userShares.map(async (share) => {
        const items = await db
          .select()
          .from(wishlistItems)
          .where(and(
            eq(wishlistItems.userId, share.userId),
            eq(wishlistItems.familyId, share.sourceFamilyId)
          ));
        return items.map(item => ({
          ...item,
          isShared: true,
          sourceFamily: share.sourceFamilyId,
        }));
      })
    );
    
    const sharedManagedItems = await Promise.all(
      managedShares.map(async (share) => {
        const items = await db
          .select()
          .from(wishlistItems)
          .where(and(
            eq(wishlistItems.managedProfileId, share.managedProfileId),
            eq(wishlistItems.familyId, share.sourceFamilyId)
          ));
        return items.map(item => ({
          ...item,
          isShared: true,
          sourceFamily: share.sourceFamilyId,
        }));
      })
    );
    
    const allItems = [
      ...nativeItems.map(item => ({ ...item, isShared: false })),
      ...sharedUserItems.flat(),
      ...sharedManagedItems.flat(),
    ];
    
    const uniqueItems = allItems.reduce((acc, item) => {
      if (!acc.some(i => i.id === item.id)) {
        acc.push(item);
      }
      return acc;
    }, [] as typeof allItems);
    
    const itemsWithPurchaseStatus = await Promise.all(
      uniqueItems.map(async (item) => {
        const purchase = await this.getItemPurchase(item.id);
        const isOwner = item.userId === viewerId;
        
        let ownerInfo = null;
        if (item.userId) {
          const user = await this.getUser(item.userId);
          if (user) {
            ownerInfo = {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              profileImageUrl: user.profileImageUrl,
              isManagedProfile: false,
            };
          }
        } else if (item.managedProfileId) {
          const profile = await this.getManagedProfile(item.managedProfileId);
          if (profile) {
            ownerInfo = {
              id: profile.id,
              firstName: profile.firstName,
              lastName: profile.lastName,
              profileImageUrl: profile.profileImageUrl,
              isManagedProfile: true,
            };
          }
        }
        
        return {
          ...item,
          isPurchased: !!purchase,
          isPurchasedByViewer: purchase?.purchasedById === viewerId,
          purchasedBy: isOwner ? null : (purchase ? {
            id: purchase.purchasedById,
          } : null),
          owner: ownerInfo,
        };
      })
    );
    
    return itemsWithPurchaseStatus;
  }
}

export const storage = new DatabaseStorage();
