import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, AuthorizationError, NotFoundError } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendInviteEmail } from "./emailService";
import * as cheerio from "cheerio";
import { ObjectStorageService, ObjectNotFoundError, objectStorageClient } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import memoize from "memoizee";
import { bulkDeleteItemsSchema, bulkUpdatePrioritySchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.put('/api/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate input with Zod schema - allow base64 data URIs or URLs for profile images
      const updateUserSchema = z.object({
        firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
        lastName: z.string().trim().min(1, "Last name cannot be empty").optional(),
        profileImageUrl: z.string().refine(
          (val) => {
            if (!val || val === '') return true; // Allow empty string
            if (val.startsWith('data:image/')) return true; // Allow data URIs
            try {
              new URL(val); // Check if valid HTTP/HTTPS URL
              return true;
            } catch {
              return false;
            }
          },
          "Must be a valid URL or base64 data URI"
        ).optional(),
      });

      const validatedData = updateUserSchema.parse(req.body);

      // If no fields to update, return current user without error (no-op)
      if (!validatedData.firstName && !validatedData.lastName && !validatedData.profileImageUrl) {
        const user = await storage.getUser(userId);
        return res.json(user);
      }

      // Only include defined fields in the update
      const updates: any = {};
      if (validatedData.firstName !== undefined) updates.firstName = validatedData.firstName;
      if (validatedData.lastName !== undefined) updates.lastName = validatedData.lastName;
      if (validatedData.profileImageUrl !== undefined) updates.profileImageUrl = validatedData.profileImageUrl;

      const user = await storage.updateUser(userId, updates);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  // Organizer can update any member's profile (global name change)
  app.put('/api/families/:familyId/members/:userId/profile', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { familyId, userId } = req.params;

      // Verify requester is the family organizer
      const family = await storage.getFamily(familyId);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      if (family.createdById !== requesterId) {
        return res.status(403).json({ message: "Only the family organizer can update member profiles" });
      }

      // Validate input
      const updateUserSchema = z.object({
        firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
        lastName: z.string().trim().min(1, "Last name cannot be empty").optional(),
      });

      const validatedData = updateUserSchema.parse(req.body);

      // Only include defined fields in the update
      const updates: any = {};
      if (validatedData.firstName !== undefined) updates.firstName = validatedData.firstName;
      if (validatedData.lastName !== undefined) updates.lastName = validatedData.lastName;

      if (Object.keys(updates).length === 0) {
        const user = await storage.getUser(userId);
        return res.json(user);
      }

      const user = await storage.updateUser(userId, updates);
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating member profile:", error);
      res.status(500).json({ message: "Failed to update member profile" });
    }
  });

  // Family routes
  app.post('/api/families', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Family name is required" });
      }

      // Generate unique invite code
      const inviteCode = randomBytes(6).toString('hex').toUpperCase();

      const family = await storage.createFamily({
        name,
        inviteCode,
        createdById: userId,
      });

      res.json(family);
    } catch (error) {
      console.error("Error creating family:", error);
      res.status(500).json({ message: "Failed to create family" });
    }
  });

  app.post('/api/families/join', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { inviteCode } = req.body;

      if (!inviteCode || typeof inviteCode !== 'string') {
        return res.status(400).json({ message: "Invite code is required" });
      }

      const family = await storage.getFamilyByInviteCode(inviteCode);
      if (!family) {
        return res.status(404).json({ message: "Family not found with this invite code" });
      }

      // Check if user is already a member
      const existingMember = await storage.getFamilyMember(family.id, userId);
      if (existingMember) {
        return res.status(400).json({ message: "You are already a member of this family" });
      }

      await storage.addFamilyMember({
        familyId: family.id,
        userId,
      });

      // Log activity
      await storage.createActivityLog({
        familyId: family.id,
        actorId: userId,
        action: "member_joined",
        metadata: {
          familyName: family.name,
        },
      });

      res.json({ message: "Successfully joined family", family });
    } catch (error) {
      console.error("Error joining family:", error);
      res.status(500).json({ message: "Failed to join family" });
    }
  });

  app.get('/api/families', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const families = await storage.getUserFamilies(userId);
      res.json(families);
    } catch (error) {
      console.error("Error fetching families:", error);
      res.status(500).json({ message: "Failed to fetch families" });
    }
  });

  app.put('/api/families/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      const updateFamilySchema = z.object({
        name: z.string().trim().min(1, "Family name cannot be empty").optional(),
      });

      const validatedData = updateFamilySchema.parse(req.body);

      const family = await storage.updateFamily(familyId, validatedData, userId);
      res.json(family);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      if (error instanceof Error && error.message.includes("Only the family organizer")) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof Error && error.message === "Family not found") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error updating family:", error);
      res.status(500).json({ message: "Failed to update family" });
    }
  });

  // Update personal gift budget for a family
  app.put('/api/families/:familyId/budget', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      const budgetSchema = z.object({
        giftBudget: z.number().min(0, "Budget must be non-negative").nullable(),
      });

      const { giftBudget } = budgetSchema.parse(req.body);
      
      // Convert to string for database storage (with 2 decimal places)
      const budgetValue = giftBudget !== null ? giftBudget.toFixed(2) : null;

      await storage.updateFamilyMemberBudget(familyId, userId, budgetValue);
      res.json({ message: "Budget updated successfully", giftBudget: budgetValue });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating gift budget:", error);
      res.status(500).json({ message: "Failed to update gift budget" });
    }
  });

  // Send family invitation email
  app.post('/api/families/:familyId/invitations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;
      const { email } = req.body;

      // Validate email
      const emailSchema = z.string().email();
      const validationResult = emailSchema.safeParse(email);
      if (!validationResult.success) {
        return res.status(400).json({ message: "Valid email address is required" });
      }

      // Verify user is a member of the family
      const member = await storage.getFamilyMember(familyId, userId);
      if (!member) {
        return res.status(403).json({ message: "You must be a member of this family to send invitations" });
      }

      // Get family details
      const families = await storage.getUserFamilies(userId);
      const family = families.find((f: any) => f.id === familyId);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }

      if (!family.inviteCode) {
        return res.status(500).json({ message: "Family invite code is missing" });
      }

      // Get user details for the "from" name
      const user = await storage.getUser(userId);
      const inviterName = user ? `${user.firstName} ${user.lastName}` : 'A family member';

      // Generate invite link
      const baseUrl = process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : req.protocol + '://' + req.get('host');
      const inviteLink = `${baseUrl}/families/join?code=${family.inviteCode}`;

      // Send the email
      const result = await sendInviteEmail({
        to: email,
        familyName: family.name,
        inviterName,
        inviteCode: family.inviteCode,
        inviteLink,
      });

      if (!result.success) {
        return res.status(500).json({ message: result.error || "Failed to send invitation email" });
      }

      res.json({ message: "Invitation sent successfully" });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Leave family
  app.delete('/api/families/:familyId/leave', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      await storage.leaveFamily(familyId, userId);
      res.json({ message: "Successfully left family" });
    } catch (error: any) {
      console.error("Error leaving family:", error);
      res.status(400).json({ message: error.message || "Failed to leave family" });
    }
  });

  // Remove member from family (organizer only)
  app.put('/api/families/:familyId/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { familyId, userId } = req.params;

      const updateMemberSchema = z.object({
        displayName: z.string().trim().nullable().optional(),
      });

      const validatedData = updateMemberSchema.parse(req.body);

      const member = await storage.updateFamilyMemberDisplayName(
        familyId,
        userId,
        validatedData.displayName ?? null,
        requesterId
      );
      res.json(member);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      if (error.message.includes("Only the family organizer")) {
        return res.status(403).json({ message: error.message });
      }
      if (error.message === "Family not found" || error.message === "Family member not found") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error updating member display name:", error);
      res.status(500).json({ message: "Failed to update member display name" });
    }
  });

  app.delete('/api/families/:familyId/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { familyId, userId } = req.params;

      await storage.removeFamilyMember(familyId, userId, requesterId);
      res.json({ message: "Member removed successfully" });
    } catch (error: any) {
      console.error("Error removing member:", error);
      res.status(400).json({ message: error.message || "Failed to remove member" });
    }
  });

  // Family members routes
  app.get('/api/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.query;
      
      if (familyId && typeof familyId === 'string') {
        const members = await storage.getFamilyMembersByFamily(familyId, userId);
        res.json(members);
      } else {
        const members = await storage.getFamilyMembers(userId);
        res.json(members);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
      res.status(500).json({ message: "Failed to fetch family members" });
    }
  });

  app.get('/api/members/:userId', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching member:", error);
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.get('/api/members/:userId/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const viewerId = req.user.claims.sub;
      const { userId } = req.params;
      const { familyId } = req.query;

      // Don't allow viewing own wishlist this way
      if (userId === viewerId) {
        return res.status(400).json({ message: "Use /api/wishlist to view your own items" });
      }

      const items = await storage.getMemberWishlistItems(userId, viewerId, familyId as string | undefined);
      res.json(items);
    } catch (error) {
      console.error("Error fetching member wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  // Wishlist routes
  app.get('/api/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId, sort, order, priority, itemType } = req.query;
      
      // Validate and sanitize query params
      const validSorts = ['name', 'price', 'priority', 'createdAt'];
      const validOrders = ['asc', 'desc'];
      const validPriorities = ['high', 'medium', 'low'];
      const validItemTypes = ['product', 'experience', 'service', 'membership', 'other'];
      
      // Build filter options with validation
      const options = {
        sort: sort && validSorts.includes(sort as string) ? (sort as 'name' | 'price' | 'priority' | 'createdAt') : undefined,
        order: order && validOrders.includes(order as string) ? (order as 'asc' | 'desc') : undefined,
        priority: priority && validPriorities.includes(priority as string) ? (priority as 'high' | 'medium' | 'low') : undefined,
        itemType: itemType && validItemTypes.includes(itemType as string) ? (itemType as 'product' | 'experience' | 'service' | 'membership' | 'other') : undefined,
      };
      
      if (familyId && typeof familyId === 'string') {
        const items = await storage.getUserWishlistItemsByFamily(userId, familyId, options);
        res.json(items);
      } else {
        const items = await storage.getUserWishlistItems(userId, options);
        res.json(items);
      }
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.post('/api/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, price, url, imageUrl, priority, quantity, category, itemType, familyId, override } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      // Use provided familyId or get user's first family
      let targetFamilyId = familyId;
      if (!targetFamilyId) {
        const families = await storage.getUserFamilies(userId);
        if (families.length === 0) {
          return res.status(400).json({ message: "You must join a family before adding wishlist items" });
        }
        targetFamilyId = families[0].id;
      }

      // Verify user is a member of the target family
      const membership = await storage.getFamilyMember(targetFamilyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      // Check for duplicate items by URL (if provided and not overriding)
      if (url && !override) {
        const duplicate = await storage.findDuplicateWishlistItem(userId, targetFamilyId, url);
        if (duplicate) {
          return res.status(409).json({ 
            message: "This item is already on your wishlist",
            duplicateItem: {
              id: duplicate.id,
              name: duplicate.name,
              url: duplicate.url,
            }
          });
        }
      }

      const item = await storage.createWishlistItem({
        userId,
        familyId: targetFamilyId,
        name,
        description: description || null,
        price: price ? String(price) : null,
        url: url || null,
        imageUrl: imageUrl || null,
        source: "manual",
        productId: null,
        priority: priority || "medium",
        quantity: quantity || 1,
        category: category || null,
        itemType: itemType || "product",
      });

      // Log activity
      await storage.createActivityLog({
        familyId: targetFamilyId,
        actorId: userId,
        action: "item_added",
        itemId: item.id,
        metadata: {
          itemName: name,
          priority: priority || "medium",
          itemType: itemType || "product",
        },
      });

      res.json(item);
    } catch (error) {
      console.error("Error creating wishlist item:", error);
      res.status(500).json({ message: "Failed to create wishlist item" });
    }
  });

  app.post('/api/wishlist/from-search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, price, url, imageUrl, productId, source, priority, quantity, category, itemType, familyId, override } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      // Use provided familyId or get user's first family
      let targetFamilyId = familyId;
      if (!targetFamilyId) {
        const families = await storage.getUserFamilies(userId);
        if (families.length === 0) {
          return res.status(400).json({ message: "You must join a family before adding wishlist items" });
        }
        targetFamilyId = families[0].id;
      }

      // Verify user is a member of the target family
      const membership = await storage.getFamilyMember(targetFamilyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      // Check for duplicate items by URL or productId (if provided and not overriding)
      if ((url || productId) && !override) {
        const duplicate = await storage.findDuplicateWishlistItem(userId, targetFamilyId, url, productId);
        if (duplicate) {
          return res.status(409).json({ 
            message: "This item is already on your wishlist",
            duplicateItem: {
              id: duplicate.id,
              name: duplicate.name,
              url: duplicate.url,
              productId: duplicate.productId,
            }
          });
        }
      }

      const item = await storage.createWishlistItem({
        userId,
        familyId: targetFamilyId,
        name,
        description: description || null,
        price: price ? String(price) : null,
        url: url || null,
        imageUrl: imageUrl || null,
        source: source || "google_shopping",
        productId: productId || null,
        priority: priority || "medium",
        quantity: quantity || 1,
        category: category || null,
        itemType: itemType || "product",
      });

      // Log activity
      await storage.createActivityLog({
        familyId: targetFamilyId,
        actorId: userId,
        action: "item_added",
        itemId: item.id,
        metadata: {
          itemName: name,
          priority: priority || "medium",
          itemType: itemType || "product",
          source: source || "google_shopping",
        },
      });

      res.json(item);
    } catch (error) {
      console.error("Error adding item from search:", error);
      res.status(500).json({ message: "Failed to add item" });
    }
  });

  // Organizer-only: Add wishlist item to any member's wishlist
  app.post('/api/families/:familyId/members/:targetUserId/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const organizerId = req.user.claims.sub;
      const { familyId, targetUserId } = req.params;
      const { name, description, price, url, imageUrl, productId, source, priority, quantity, category } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      // Verify requester is the organizer of the family
      const family = await storage.getFamily(familyId);
      if (!family || family.createdById !== organizerId) {
        return res.status(403).json({ message: "Only the family organizer can add items to other members' wishlists" });
      }

      // Verify target user is a member of the family
      const targetMembership = await storage.getFamilyMember(familyId, targetUserId);
      if (!targetMembership) {
        return res.status(404).json({ message: "Target member not found in this family" });
      }

      const item = await storage.createWishlistItem({
        userId: targetUserId,
        familyId,
        name,
        description: description || null,
        price: price ? String(price) : null,
        url: url || null,
        imageUrl: imageUrl || null,
        source: source || "manual",
        productId: productId || null,
        priority: priority || "medium",
        quantity: quantity || 1,
        category: category || null,
      });

      res.json(item);
    } catch (error) {
      console.error("Error adding item to member's wishlist:", error);
      res.status(500).json({ message: "Failed to add item" });
    }
  });

  app.patch('/api/wishlist/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { name, description, price, url, imageUrl, priority, quantity, category, itemType } = req.body;

      const item = await storage.getWishlistItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.userId !== userId) {
        return res.status(403).json({ message: "You can only edit your own items" });
      }

      const updated = await storage.updateWishlistItem(id, {
        name: name || item.name,
        description: description !== undefined ? description : item.description,
        price: price !== undefined ? (price ? String(price) : null) : item.price,
        url: url !== undefined ? url : item.url,
        imageUrl: imageUrl !== undefined ? imageUrl : item.imageUrl,
        priority: priority !== undefined ? priority : item.priority,
        quantity: quantity !== undefined ? quantity : item.quantity,
        category: category !== undefined ? category : item.category,
        itemType: itemType !== undefined ? itemType : item.itemType,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating wishlist item:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  app.delete('/api/wishlist/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const item = await storage.getWishlistItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own items" });
      }

      // Log activity before deletion
      await storage.createActivityLog({
        familyId: item.familyId,
        actorId: userId,
        action: "item_deleted",
        metadata: {
          itemName: item.name,
          itemType: item.itemType,
        },
      });

      await storage.deleteWishlistItem(id);
      res.json({ message: "Item deleted" });
    } catch (error) {
      console.error("Error deleting wishlist item:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // Bulk delete wishlist items
  app.post('/api/wishlist/bulk-delete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = bulkDeleteItemsSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });
      }

      const { itemIds, familyId } = parsed.data;

      // Delete items and get the deleted items for activity logging
      const deletedItems = await storage.bulkDeleteWishlistItems(userId, familyId, itemIds);

      // Log activity for each deleted item
      for (const item of deletedItems) {
        await storage.createActivityLog({
          familyId: item.familyId,
          actorId: userId,
          action: "item_deleted",
          metadata: {
            itemName: item.name,
            itemType: item.itemType,
          },
        });
      }

      res.json({ 
        message: `${deletedItems.length} item(s) deleted`,
        deletedCount: deletedItems.length
      });
    } catch (error: any) {
      console.error("Error bulk deleting wishlist items:", error);
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to delete items" });
    }
  });

  // Bulk update priority for wishlist items
  app.patch('/api/wishlist/bulk-priority', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = bulkUpdatePrioritySchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", errors: parsed.error.errors });
      }

      const { itemIds, priority, familyId } = parsed.data;

      // Update items
      const updatedItems = await storage.bulkUpdateWishlistPriority(userId, familyId, itemIds, priority);

      res.json({
        message: `${updatedItems.length} item(s) updated`,
        updatedCount: updatedItems.length,
        items: updatedItems
      });
    } catch (error: any) {
      console.error("Error bulk updating wishlist priorities:", error);
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to update priorities" });
    }
  });

  // Purchase tracking routes
  app.post('/api/wishlist/:id/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { notes } = req.body;

      const item = await storage.getWishlistItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.userId === userId) {
        return res.status(400).json({ message: "You cannot mark your own items as purchased" });
      }

      // Check if this user has already purchased this item
      const existingUserPurchase = await storage.getUserPurchaseForItem(id, userId);
      if (existingUserPurchase) {
        return res.status(400).json({ message: "You have already marked this item as purchased" });
      }

      const purchase = await storage.markItemPurchased({
        itemId: id,
        purchasedById: userId,
        notes: notes || null,
      });

      // Log activity
      await storage.createActivityLog({
        familyId: item.familyId,
        actorId: userId,
        targetUserId: item.userId,
        itemId: id,
        action: "item_purchased",
        metadata: {
          itemName: item.name,
          price: item.price,
        },
      });

      res.json(purchase);
    } catch (error) {
      console.error("Error marking item purchased:", error);
      res.status(500).json({ message: "Failed to mark item as purchased" });
    }
  });

  app.delete('/api/wishlist/:id/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Get this user's specific purchase for this item
      const purchase = await storage.getUserPurchaseForItem(id, userId);
      if (!purchase) {
        return res.status(404).json({ message: "You have not marked this item as purchased" });
      }

      // Get item data for activity log before unmarking
      const item = await storage.getWishlistItem(id);
      if (item) {
        await storage.createActivityLog({
          familyId: item.familyId,
          actorId: userId,
          targetUserId: item.userId,
          itemId: id,
          action: "item_unpurchased",
          metadata: {
            itemName: item.name,
          },
        });
      }

      await storage.unmarkItemPurchased(id, userId);
      res.json({ message: "Purchase marking removed" });
    } catch (error) {
      console.error("Error unmarking purchase:", error);
      res.status(500).json({ message: "Failed to remove purchase marking" });
    }
  });

  app.get('/api/purchases', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.query;

      if (!familyId || typeof familyId !== 'string') {
        return res.status(400).json({ message: "familyId is required" });
      }

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const purchases = await storage.getPurchasedItemsByUser(userId, familyId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching purchased items:", error);
      res.status(500).json({ message: "Failed to fetch purchased items" });
    }
  });

  // Object storage routes (for wishlist item image uploads)
  // Get presigned URL for uploading image
  app.post('/api/objects/upload', isAuthenticated, async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ message: "Failed to get upload URL" });
    }
  });

  // Set ACL policy for uploaded wishlist item image
  app.put('/api/wishlist-images', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.body.imageUrl) {
        return res.status(400).json({ message: "imageUrl is required" });
      }

      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      
      // Set ACL policy: public visibility so family members can view the image
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageUrl,
        {
          owner: userId,
          visibility: "public", // Public so family members can see wishlist images
        }
      );

      res.json({ objectPath });
    } catch (error) {
      console.error("Error setting wishlist image ACL:", error);
      res.status(500).json({ message: "Failed to set image ACL" });
    }
  });

  // Serve uploaded images with ACL check
  // For camera-search images, allow public access (no auth required)
  // For other images, require authentication and ACL check
  app.get('/objects/:objectPath(*)', async (req: any, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const requestedPath = req.params.objectPath || '';
      
      // Check if this is a camera-search image (public access)
      const isCameraSearch = requestedPath.startsWith('camera-search-');
      
      if (isCameraSearch) {
        // Public access for camera search images - try to serve from public directory
        const publicFile = await objectStorageService.searchPublicObject(requestedPath);
        
        if (!publicFile) {
          return res.sendStatus(404);
        }
        
        return objectStorageService.downloadObject(publicFile, res);
      }
      
      // For other images, require authentication
      if (!req.user) {
        return res.sendStatus(401);
      }
      
      const userId = req.user.claims.sub;
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });

      if (!canAccess) {
        return res.sendStatus(401);
      }

      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Cached product search function (memoized for 10 minutes)
  const cachedProductSearch = memoize(
    async (query: string, apiKey: string) => {
      const searchUrl = new URL('https://serpapi.com/search');
      searchUrl.searchParams.set('engine', 'google_shopping');
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('api_key', apiKey);
      
      // Add location and language parameters for better, faster results
      searchUrl.searchParams.set('location', 'United States');
      searchUrl.searchParams.set('google_domain', 'google.com');
      searchUrl.searchParams.set('hl', 'en');
      searchUrl.searchParams.set('gl', 'us');
      
      // Reduced from 20 to 10 for faster response
      searchUrl.searchParams.set('num', '10');

      const response = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("SerpApi error:", response.status, errorText);
        throw new Error('Search service error');
      }

      const data = await response.json();
      const results = data.shopping_results || [];
      
      console.log(`[Product Search] Query: "${query}" - Found ${results.length} results (cached)`);
      
      // Helper to parse review counts
      const parseReviewCount = (reviews: any) => {
        if (!reviews) return 0;
        const str = String(reviews).toLowerCase();
        if (str.includes('k')) return parseFloat(str) * 1000;
        return parseInt(str.replace(/[^\d]/g, '')) || 0;
      };
      
      // Define reputable US retailers and brands (normalized domain keywords)
      const trustedRetailers = [
        'amazon', 'bestbuy', 'target', 'walmart', 'apple', 'samsung',
        'newegg', 'bhphotovideo', 'costco', 'homedepot',
        'lowes', 'macys', 'nordstrom', 'sephora', 'ulta',
        'kohls', 'jcpenney', 'sears', 'staples', 'officedepot',
        'dell', 'hp', 'lenovo', 'microsoft', 'sony', 'lg', 'panasonic',
        'nike', 'adidas', 'underarmour', 'rei', 'dickssportinggoods',
        'gamestop', 'barnesandnoble', 'chewy', 'petco', 'petsmart',
        'google', 'ebay', 'etsy', 'wayfair', 'overstock'
      ];
      
      // Sites to exclude from results (normalized domain keywords)
      const excludedRetailers = [
        'temu', 'wish', 'aliexpress', 'dhgate', 'banggood', 'gearbest'
      ];
      
      // Helper to extract actual merchant URL from Google redirect (recursive to handle nested redirects)
      const extractMerchantUrl = (urlString: string, depth: number = 0): string => {
        if (!urlString || depth > 5) return urlString; // Prevent infinite recursion
        
        try {
          const url = new URL(urlString);
          
          // If it's a Google redirect, extract the actual merchant URL
          if (url.hostname.includes('google.com')) {
            // Try common Google redirect parameters and decode them
            const encodedMerchantUrl = url.searchParams.get('url') || 
                                      url.searchParams.get('u') || 
                                      url.searchParams.get('q');
            
            if (encodedMerchantUrl) {
              // Decode the URL parameter
              const decodedUrl = decodeURIComponent(encodedMerchantUrl);
              
              // Recursively extract in case of nested redirects
              return extractMerchantUrl(decodedUrl, depth + 1);
            }
          }
          
          // Return original URL if not a redirect
          return urlString;
        } catch {
          // If URL parsing fails, try to decode anyway in case it's just encoded
          try {
            const decoded = decodeURIComponent(urlString);
            if (decoded !== urlString && depth < 5) {
              return extractMerchantUrl(decoded, depth + 1);
            }
          } catch {}
          return urlString;
        }
      };
      
      // Helper to extract and normalize hostname from URL
      const extractHostname = (urlString: string): string => {
        try {
          // First extract the actual merchant URL if it's a Google redirect
          const actualUrl = extractMerchantUrl(urlString);
          
          // Handle both full URLs and partial URLs
          const url = actualUrl.startsWith('http') ? new URL(actualUrl) : new URL(`https://${actualUrl}`);
          return url.hostname.toLowerCase().replace(/^www\./, '');
        } catch {
          return urlString.toLowerCase().replace(/^www\./, '');
        }
      };
      
      // Helper to normalize text for matching (remove spaces, apostrophes, special chars)
      const normalizeForMatching = (text: string): string => {
        return text.toLowerCase().replace(/[\s'&-]+/g, '');
      };
      
      // Helper to check if a hostname or source matches a retailer keyword
      const matchesRetailer = (source: string, link: string, retailer: string): boolean => {
        const normalizedRetailer = normalizeForMatching(retailer);
        const normalizedSource = normalizeForMatching(source || '');
        const hostname = extractHostname(link || '');
        
        // Check if source contains retailer name
        if (normalizedSource.includes(normalizedRetailer)) {
          return true;
        }
        
        // Check if hostname contains retailer (e.g., amazon.com, store.apple.com)
        if (hostname.includes(normalizedRetailer)) {
          return true;
        }
        
        return false;
      };
      
      // Helper to identify brand from search query
      const extractBrandFromQuery = (query: string): string | null => {
        const normalizedQuery = normalizeForMatching(query);
        
        // Check if query contains any of the brand names
        // Prioritize longer matches first (e.g., "bestbuy" before "best")
        const sortedBrands = [...trustedRetailers].sort((a, b) => b.length - a.length);
        
        for (const brand of sortedBrands) {
          const normalizedBrand = normalizeForMatching(brand);
          if (normalizedQuery.includes(normalizedBrand)) {
            return brand;
          }
        }
        return null;
      };
      
      // Normalize and sort results by reputation, brand relevance, and popularity
      // Prioritize brand websites first, then reputable retailers, exclude bad sites
      const sortedResults = results
        .map((result: any) => {
          // Extract rating
          const rating = parseFloat(String(result.rating || result.product_rating || '0').replace(/[^\d.]/g, '')) || 0;
          const reviews = parseReviewCount(result.reviews || result.reviews_count || result.rating_count);
          
          // Try to find the direct store link
          // Priority: direct merchant link > product_link > fallback to Google redirect
          let link = '';
          if (result.merchant_link || result.product_link) {
            // Use direct link if available
            link = result.merchant_link || result.product_link;
          } else if (result.link) {
            // Fallback to Google redirect
            link = result.link;
          }
          
          // Extract actual merchant URL from potential Google redirects
          const merchantUrl = extractMerchantUrl(link);
          const source = result.source || result.merchant || '';
          
          // Check if this is an excluded retailer (check both source and actual merchant URL)
          const isExcluded = excludedRetailers.some(excluded => 
            matchesRetailer(source, merchantUrl, excluded)
          );
          
          // Calculate popularity score
          const popularity = rating * Math.log10(reviews + 1);
          
          // Determine retailer tier for sorting priority
          let retailerTier = 2; // Default: unknown retailer
          
          // Check if this is the brand's own website (highest priority)
          const queryBrand = extractBrandFromQuery(query);
          if (queryBrand && matchesRetailer(source, merchantUrl, queryBrand)) {
            retailerTier = 0; // Brand website (e.g., apple.com for "apple iphone")
          }
          // Check if this is a trusted retailer
          else if (trustedRetailers.some(retailer => matchesRetailer(source, merchantUrl, retailer))) {
            retailerTier = 1; // Reputable retailer
          }
          
          return {
            ...result,
            link: link,
            snippet: result.snippet || result.description || '',
            extracted_price: result.extracted_price || (typeof result.price === 'number' ? result.price : null),
            _popularity: popularity,
            _position: result.position || Infinity,
            _retailerTier: retailerTier,
            _isExcluded: isExcluded,
          };
        })
        // Filter out excluded retailers
        .filter((result: any) => !result._isExcluded)
        .sort((a: any, b: any) => {
          // First, sort by retailer tier (0 = brand site, 1 = trusted retailer, 2 = other)
          if (a._retailerTier !== b._retailerTier) {
            return a._retailerTier - b._retailerTier;
          }
          
          // Within same tier, prioritize by popularity score
          if (a._popularity > 0 || b._popularity > 0) {
            if (a._popularity !== b._popularity) return b._popularity - a._popularity;
          }
          
          // Fallback to position (Google's relevance ordering)
          return a._position - b._position;
        })
        .map(({ _popularity, _position, _retailerTier, _isExcluded, ...result }: any) => result); // Remove temp fields
      
      // Return only essential fields to reduce payload size
      return sortedResults.map((result: any) => ({
        position: result.position,
        title: result.title,
        link: result.link,
        product_link: result.product_link,
        product_id: result.product_id,
        serpapi_product_api: result.serpapi_product_api,
        source: result.source,
        price: result.price,
        extracted_price: result.extracted_price,
        thumbnail: result.thumbnail,
        delivery: result.delivery,
        snippet: result.snippet,
        rating: result.rating,
        reviews: result.reviews,
      }));
    },
    {
      promise: true,
      maxAge: 10 * 60 * 1000, // Cache for 10 minutes
      preFetch: true, // Background refresh before expiry
      normalizer: ([query]: [string, string]) => query.toLowerCase().trim(), // Normalize cache key
    }
  );

  // Product search route (SerpApi integration)
  app.get('/api/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      const apiKey = process.env.SERPAPI_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Search service not configured" });
      }

      const results = await cachedProductSearch(q, apiKey);
      res.json(results);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Image search route (Google Lens via SerpApi)
  app.post('/api/search/image', isAuthenticated, async (req: any, res) => {
    try {
      // Validate request body with proper Base64 payload validation
      const imageSearchSchema = z.string()
        .refine(
          (val) => val.startsWith('data:image/'),
          "Image must be a valid base64 data URI"
        )
        .refine(
          (val) => {
            // Validate it's an actual image format
            const validFormats = ['data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/webp'];
            return validFormats.some(format => val.startsWith(format));
          },
          "Image must be in JPEG, PNG, or WebP format"
        )
        .refine(
          (val) => {
            try {
              // Extract Base64 payload after the prefix (e.g., "data:image/jpeg;base64,")
              const base64Match = val.match(/^data:image\/[^;]+;base64,(.+)$/);
              if (!base64Match || !base64Match[1]) {
                return false;
              }
              const base64Payload = base64Match[1];
              
              // Verify it's valid Base64
              const decoded = Buffer.from(base64Payload, 'base64');
              
              // Check decoded size (10MB limit)
              const sizeInMB = decoded.length / (1024 * 1024);
              return sizeInMB <= 10;
            } catch {
              return false;
            }
          },
          "Image size must not exceed 10MB and must be valid Base64"
        );

      const image = imageSearchSchema.parse(req.body.image);

      const apiKey = process.env.SERPAPI_KEY;
      if (!apiKey) {
        console.error("SERPAPI_KEY environment variable not set");
        return res.status(500).json({ message: "Search service not configured" });
      }

      // Extract base64 payload (remove data:image/jpeg;base64, prefix)
      const base64Match = image.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (!base64Match || !base64Match[2]) {
        return res.status(400).json({ message: "Invalid image format" });
      }
      const imageFormat = base64Match[1]; // jpeg, png, webp
      const base64Payload = base64Match[2];

      console.log(`Image search: ${imageFormat}, payload size ${Math.round(base64Payload.length / 1024)}KB`);

      // Upload to object storage (public directory) to get a URL
      const publicObjectSearchPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
      const publicPaths = publicObjectSearchPaths.split(',').map(p => p.trim()).filter(Boolean);
      if (publicPaths.length === 0) {
        return res.status(500).json({ message: "Object storage not configured" });
      }

      // Use first public path
      const publicPath = publicPaths[0];
      const tempFileName = `camera-search-${Date.now()}.${imageFormat}`;
      const fullPath = `${publicPath}/${tempFileName}`;

      // Parse bucket and object name
      const pathParts = fullPath.split('/').filter(Boolean);
      const bucketName = pathParts[0];
      const objectName = pathParts.slice(1).join('/');

      console.log(`Uploading to: ${bucketName}/${objectName}`);

      // Upload image to object storage
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      const imageBuffer = Buffer.from(base64Payload, 'base64');
      await file.save(imageBuffer, {
        metadata: {
          contentType: `image/${imageFormat}`,
        },
      });

      console.log(`Image uploaded successfully`);

      // Get public URL for the image
      // Use PUBLIC_BASE_URL env var if set (for production), otherwise use request host
      const baseUrl = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
      const imageUrl = `${baseUrl}/objects/${tempFileName}`;
      console.log(`Public URL: ${imageUrl}`);

      // Call SerpApi Google Lens API with the public URL
      const searchUrl = new URL('https://serpapi.com/search');
      searchUrl.searchParams.set('engine', 'google_lens');
      searchUrl.searchParams.set('api_key', apiKey);
      searchUrl.searchParams.set('url', imageUrl);
      
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(15000), // 15 second timeout for image processing
      });

      console.log(`SerpApi response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        const truncatedError = errorText.substring(0, 500);
        console.error(`SerpApi Google Lens error: ${response.status} - ${truncatedError}`);
        
        // Provide user-friendly error messages
        if (response.status === 401) {
          return res.status(500).json({ message: "Search service authentication failed" });
        } else if (response.status === 429) {
          return res.status(429).json({ message: "Too many searches. Please try again in a moment." });
        } else if (response.status >= 400 && response.status < 500) {
          return res.status(400).json({ message: "Invalid image. Please try a different photo." });
        }
        
        throw new Error('Image search service error');
      }

      const data = await response.json();
      
      // Log the raw response structure for debugging
      console.log(`SerpApi response keys: ${Object.keys(data).join(', ')}`);
      
      // Check for error in response
      if (data.error) {
        console.error(`SerpApi error: ${JSON.stringify(data.error)}`);
      }
      
      // Log search parameters sent
      if (data.search_parameters) {
        console.log(`Search params: ${JSON.stringify(data.search_parameters)}`);
      }
      
      console.log(`visual_matches count: ${data.visual_matches?.length || 0}`);
      console.log(`shopping_results count: ${data.shopping_results?.length || 0}`);
      
      // Log first result if available
      if (data.visual_matches?.[0]) {
        console.log(`First visual match: ${JSON.stringify(data.visual_matches[0]).substring(0, 200)}`);
      }
      if (data.shopping_results?.[0]) {
        console.log(`First shopping result: ${JSON.stringify(data.shopping_results[0]).substring(0, 200)}`);
      }
      
      // Extract visual matches and shopping results
      const visualMatches = data.visual_matches || [];
      const shoppingResults = data.shopping_results || [];
      
      // Combine and format results to match our existing product format
      const results = [...shoppingResults, ...visualMatches].slice(0, 10).map((result: any) => ({
        position: result.position || 0,
        title: result.title || result.name,
        link: result.link || result.product_link,
        product_link: result.product_link || result.link,
        source: result.source || result.store || 'Google Lens',
        price: result.price,
        extracted_price: result.extracted_price || (result.price ? parseFloat(result.price.replace(/[^0-9.]/g, '')) : undefined),
        thumbnail: result.thumbnail,
        rating: result.rating,
        reviews: result.reviews,
        snippet: result.snippet || result.description,
      }));

      console.log(`Image search successful: ${results.length} results found`);
      
      // Clean up the temporary file after sending response (best effort)
      // Wait a bit to ensure SerpApi had time to fetch it
      setTimeout(() => {
        file.delete().catch((err: any) => console.error(`Failed to cleanup temp file: ${err.message}`));
      }, 5000);
      
      res.json({ results });
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Image validation failed:", error.errors);
        return res.status(400).json({ message: "Invalid image data", errors: error.errors });
      }
      
      // Log detailed error info (without exposing API keys)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack?.substring(0, 300) : '';
      console.error(`Image search error: ${errorMessage}`, errorStack);
      
      res.status(500).json({ message: "Failed to search by image" });
    }
  });


  // Stats route
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.query;
      
      if (familyId && typeof familyId === 'string') {
        const stats = await storage.getUserStatsByFamily(userId, familyId);
        res.json(stats);
      } else {
        const stats = await storage.getUserStats(userId);
        res.json(stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get('/api/families/:familyId/purchase-totals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;
      
      const totals = await storage.getPurchaseTotalsByMember(userId, familyId);
      res.json(totals);
    } catch (error) {
      console.error("Error fetching purchase totals:", error);
      if ((error as Error).message === "You are not a member of this family") {
        return res.status(403).json({ message: "You are not a member of this family" });
      }
      res.status(500).json({ message: "Failed to fetch purchase totals" });
    }
  });

  // Error logging endpoint (authenticated to prevent spam and log injection)
  app.post('/api/logs/errors', isAuthenticated, async (req: any, res) => {
    try {
      const errorLogSchema = z.object({
        message: z.string().max(1000), // Limit message length to prevent abuse
        stack: z.string().max(5000).optional(), // Limit stack trace length
        componentStack: z.string().max(5000).optional(),
        timestamp: z.string(),
      });

      const validatedData = errorLogSchema.parse(req.body);
      const userId = req.user.claims.sub;
      
      // Log to console (in production this could go to a logging service)
      console.error('[Frontend Error]', {
        timestamp: validatedData.timestamp,
        message: validatedData.message,
        stack: validatedData.stack,
        componentStack: validatedData.componentStack,
        userId,
      });

      res.json({ success: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid error log data", errors: error.errors });
      }
      console.error("Error logging frontend error:", error);
      res.status(500).json({ message: "Failed to log error" });
    }
  });

  // Activity log routes
  app.post('/api/activities', isAuthenticated, async (req: any, res) => {
    try {
      const activitySchema = z.object({
        familyId: z.string(),
        action: z.string(),
        targetUserId: z.string().optional(),
        itemId: z.string().optional(),
        metadata: z.any().optional(),
      });

      const validatedData = activitySchema.parse(req.body);
      const userId = req.user.claims.sub;

      const activity = await storage.createActivityLog({
        ...validatedData,
        actorId: userId,
      });

      res.json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid activity data", errors: error.errors });
      }
      console.error("Error creating activity log:", error);
      res.status(500).json({ message: "Failed to log activity" });
    }
  });

  app.get('/api/activities', isAuthenticated, async (req: any, res) => {
    try {
      const { familyId, limit } = req.query;
      const userId = req.user.claims.sub;

      if (!familyId || typeof familyId !== 'string') {
        return res.status(400).json({ message: "Family ID is required" });
      }

      // Verify user is a member of this family
      const membership = await storage.getFamilyMember(familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const activities = await storage.getRecentActivities(
        familyId, 
        limit ? parseInt(limit as string) : 10
      );

      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
