import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendInviteEmail } from "./emailService";
import * as cheerio from "cheerio";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import memoize from "memoizee";

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
        name: z.string().trim().min(1, "Family name cannot be empty"),
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
      const { familyId } = req.query;
      
      if (familyId && typeof familyId === 'string') {
        const items = await storage.getUserWishlistItemsByFamily(userId, familyId);
        res.json(items);
      } else {
        const items = await storage.getUserWishlistItems(userId);
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
      const { name, description, price, url, imageUrl, priority, quantity, category, familyId } = req.body;

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
      const { name, description, price, url, imageUrl, productId, source, priority, quantity, category, familyId } = req.body;

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
      const { name, description, price, url, imageUrl, priority, quantity, category } = req.body;

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

      await storage.deleteWishlistItem(id);
      res.json({ message: "Item deleted" });
    } catch (error) {
      console.error("Error deleting wishlist item:", error);
      res.status(500).json({ message: "Failed to delete item" });
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

      // Check if current user has an existing record (intent or purchase)
      const userRecord = await storage.getItemPurchaseByUser(id, userId);
      
      if (userRecord) {
        // If current user already purchased, return error
        if (userRecord.status === 'purchased') {
          return res.status(400).json({ message: "You have already marked this item as purchased" });
        }
        
        // If current user has intent, upgrade to purchased
        if (userRecord.status === 'intended') {
          const purchase = await storage.confirmItemPurchase(id, userId, notes || null);
          return res.json(purchase);
        }
      }

      // Check if anyone else has an active record (intent or purchase)
      const anyRecord = await storage.getItemPurchase(id);
      if (anyRecord) {
        if (anyRecord.status === 'purchased') {
          return res.status(400).json({ message: "This item has already been purchased by someone else" });
        }
        if (anyRecord.status === 'intended') {
          return res.status(400).json({ message: "Someone else is already planning to buy this item" });
        }
      }

      // No existing record, create new purchase
      const purchase = await storage.markItemPurchased({
        itemId: id,
        purchasedById: userId,
        notes: notes || null,
      });

      res.json(purchase);
    } catch (error: any) {
      console.error("Error marking item purchased:", error);
      
      // Handle unique constraint violation (concurrent purchase attempts)
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        return res.status(409).json({ 
          message: "Someone else just marked this item - please refresh to see the latest status" 
        });
      }
      
      res.status(500).json({ message: "Failed to mark item as purchased" });
    }
  });

  app.delete('/api/wishlist/:id/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const purchase = await storage.getItemPurchase(id);
      if (!purchase) {
        return res.status(404).json({ message: "Purchase record not found" });
      }

      if (purchase.purchasedById !== userId) {
        return res.status(403).json({ message: "You can only unmark items you marked" });
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

  // Intent to buy routes (mark items as intended before purchasing)
  app.post('/api/wishlist/:id/intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;
      const { budgetAllocated, notes } = req.body;

      const item = await storage.getWishlistItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      if (item.userId === userId) {
        return res.status(400).json({ message: "You cannot mark intent on your own items" });
      }

      // Check if current user already has a record
      const userRecord = await storage.getItemPurchaseByUser(id, userId);
      if (userRecord) {
        if (userRecord.status === 'purchased') {
          return res.status(400).json({ message: "You have already marked this item as purchased" });
        }
        if (userRecord.status === 'intended') {
          return res.status(400).json({ message: "You have already marked your intent to buy this item" });
        }
      }

      // Check if anyone else has an active record (intent or purchase)
      const anyRecord = await storage.getItemPurchase(id);
      if (anyRecord) {
        if (anyRecord.status === 'purchased') {
          return res.status(400).json({ message: "This item has already been purchased by someone else" });
        }
        if (anyRecord.status === 'intended') {
          return res.status(400).json({ message: "Someone else is already planning to buy this item" });
        }
      }

      const intent = await storage.markItemIntent({
        itemId: id,
        purchasedById: userId,
        status: 'intended',
        budgetAllocated: budgetAllocated || item.price || '0',
        notes: notes || null,
      });

      res.json(intent);
    } catch (error: any) {
      console.error("Error marking item intent:", error);
      
      // Handle unique constraint violation (concurrent intent attempts)
      if (error.code === '23505' || error.message?.includes('unique constraint')) {
        return res.status(409).json({ 
          message: "Someone else just marked their intent to buy this item" 
        });
      }
      
      res.status(500).json({ message: "Failed to mark intent to buy" });
    }
  });

  app.delete('/api/wishlist/:id/intent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const intent = await storage.getItemPurchaseByUser(id, userId);
      if (!intent) {
        return res.status(404).json({ message: "Intent record not found" });
      }

      if (intent.status !== 'intended') {
        return res.status(400).json({ message: "This item is already purchased" });
      }

      await storage.unmarkItemPurchased(id, userId);
      res.json({ message: "Intent to buy cancelled" });
    } catch (error) {
      console.error("Error cancelling intent:", error);
      res.status(500).json({ message: "Failed to cancel intent" });
    }
  });

  app.put('/api/wishlist/:id/confirm-purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const intent = await storage.getItemPurchaseByUser(id, userId);
      if (!intent) {
        return res.status(404).json({ message: "Intent record not found" });
      }

      if (intent.status !== 'intended') {
        return res.status(400).json({ message: "This item is already purchased" });
      }

      const purchase = await storage.confirmItemPurchase(id, userId);
      res.json(purchase);
    } catch (error) {
      console.error("Error confirming purchase:", error);
      res.status(500).json({ message: "Failed to confirm purchase" });
    }
  });

  // Budget routes
  app.get('/api/budgets/family/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const budget = await storage.getFamilyBudget(familyId);
      res.json(budget || null);
    } catch (error) {
      console.error("Error fetching family budget:", error);
      res.status(500).json({ message: "Failed to fetch family budget" });
    }
  });

  app.put('/api/budgets/family/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;
      const { totalBudget } = req.body;

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const family = await storage.getFamily(familyId);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      
      if (family.createdById !== userId) {
        return res.status(403).json({ message: "Only the family organizer can set the family budget" });
      }

      if (!totalBudget || isNaN(parseFloat(totalBudget)) || parseFloat(totalBudget) < 0) {
        return res.status(400).json({ message: "Valid total budget is required" });
      }

      const budget = await storage.setFamilyBudget(familyId, totalBudget);
      res.json(budget);
    } catch (error) {
      console.error("Error setting family budget:", error);
      res.status(500).json({ message: "Failed to set family budget" });
    }
  });

  app.get('/api/budgets/members/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const budgets = await storage.getMemberBudgets(familyId, userId);
      res.json(budgets);
    } catch (error) {
      console.error("Error fetching member budgets:", error);
      res.status(500).json({ message: "Failed to fetch member budgets" });
    }
  });

  app.post('/api/budgets/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId, targetMemberId, amount } = req.body;

      if (!familyId || !targetMemberId || !amount) {
        return res.status(400).json({ message: "familyId, targetMemberId, and amount are required" });
      }

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const targetMember = await storage.getFamilyMember(familyId, targetMemberId);
      if (!targetMember) {
        return res.status(400).json({ message: "Target member is not in this family" });
      }

      if (targetMemberId === userId) {
        return res.status(400).json({ message: "You cannot set a budget for yourself" });
      }

      const budget = await storage.setMemberBudget({
        familyId,
        userId,
        targetMemberId,
        amount,
      });

      res.json(budget);
    } catch (error) {
      console.error("Error setting member budget:", error);
      res.status(500).json({ message: "Failed to set member budget" });
    }
  });

  app.delete('/api/budgets/members/:budgetId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { budgetId } = req.params;

      const budget = await storage.getMemberBudget(budgetId);
      if (!budget) {
        return res.status(404).json({ message: "Budget not found" });
      }

      if (budget.userId !== userId) {
        return res.status(403).json({ message: "You can only delete your own budgets" });
      }

      await storage.deleteMemberBudget(budgetId);
      res.json({ message: "Budget deleted" });
    } catch (error) {
      console.error("Error deleting member budget:", error);
      res.status(500).json({ message: "Failed to delete budget" });
    }
  });

  app.get('/api/budgets/summary/:familyId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const summary = await storage.getBudgetSummary(familyId, userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching budget summary:", error);
      res.status(500).json({ message: "Failed to fetch budget summary" });
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
  app.get('/objects/:objectPath(*)', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const objectStorageService = new ObjectStorageService();
      
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

  // URL scraping route - extract product data from any URL
  // Uses secure Open Graph metadata extraction with cheerio
  // TODO: Future enhancement - Convert URLs to Affiliate.com affiliate links for monetization
  app.post('/api/scrape-url', isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "URL is required" });
      }

      // Validate URL format
      let validUrl: URL;
      try {
        validUrl = new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      // Security Layer 1: Only allow HTTPS
      if (validUrl.protocol !== 'https:') {
        return res.status(400).json({ message: "Only HTTPS URLs are allowed for security reasons" });
      }

      // Security Layer 2: Domain allowlist for trusted retailers
      const allowedDomains = [
        // Amazon
        'amazon.com', 'amazon.co.uk', 'amazon.ca', 'amazon.de', 'amazon.fr', 
        'amazon.it', 'amazon.es', 'amazon.co.jp', 'amazon.in', 'amazon.com.au',
        // US Retailers
        'walmart.com', 'target.com', 'bestbuy.com', 'costco.com',
        'homedepot.com', 'lowes.com', 'wayfair.com',
        // Department Stores
        'macys.com', 'nordstrom.com', 'kohls.com', 'jcpenney.com',
        // Specialty Retailers
        'nike.com', 'adidas.com', 'gap.com', 'oldnavy.com',
        'apple.com', 'microsoft.com', 'dell.com', 'hp.com',
        'sephora.com', 'ulta.com', 'walgreens.com', 'cvs.com',
        'chewy.com', 'petco.com', 'petsmart.com',
        'williams-sonoma.com', 'crateandbarrel.com', 'potterybarn.com',
        // Marketplaces
        'ebay.com', 'etsy.com', 'overstock.com', 'zappos.com', 'newegg.com',
      ];

      const hostname = validUrl.hostname.toLowerCase().replace(/^www\./, '');
      const isAllowed = allowedDomains.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (!isAllowed) {
        return res.status(400).json({ 
          message: "URL must be from a supported retailer (Amazon, Walmart, Target, Best Buy, etc.)" 
        });
      }

      // Security Layer 3: Follow redirects manually to validate each hop
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout (some retailers are slow)

      let currentUrl = url;
      let redirectCount = 0;
      const maxRedirects = 5; // Prevent infinite redirect loops
      let response: Response;

      while (true) {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual', // Handle redirects manually for security
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; WishlistBot/1.0)',
          },
        });

        // Security Layer 4: Handle redirects safely
        if (response.status >= 300 && response.status < 400) {
          redirectCount++;
          if (redirectCount > maxRedirects) {
            clearTimeout(timeoutId);
            return res.status(400).json({ 
              message: "Too many redirects (>5). Please use the final destination URL." 
            });
          }

          const location = response.headers.get('location');
          if (!location) {
            clearTimeout(timeoutId);
            return res.status(400).json({ 
              message: "Invalid redirect - no location header" 
            });
          }

          // Resolve relative URLs to absolute
          try {
            const redirectUrl = new URL(location, currentUrl);
            
            // CRITICAL: Validate redirect destination is in allowlist
            const redirectHostname = redirectUrl.hostname.toLowerCase().replace(/^www\./, '');
            const redirectIsAllowed = allowedDomains.some(domain => 
              redirectHostname === domain || redirectHostname.endsWith(`.${domain}`)
            );

            if (!redirectIsAllowed) {
              clearTimeout(timeoutId);
              return res.status(400).json({ 
                message: `Redirect to ${redirectHostname} is not allowed. Only redirects within trusted retailers are permitted.` 
              });
            }

            // Redirect is safe, follow it
            currentUrl = redirectUrl.href;
            console.log(`Following safe redirect ${redirectCount}/${maxRedirects}: ${currentUrl}`);
          } catch (e) {
            clearTimeout(timeoutId);
            return res.status(400).json({ message: "Invalid redirect URL" });
          }
        } else {
          // Not a redirect, continue
          break;
        }
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        return res.status(400).json({ 
          message: `Failed to fetch URL: ${response.statusText}` 
        });
      }

      // Security Layer 5: Check content-length to prevent huge responses
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) { // 5MB limit
        return res.status(400).json({ 
          message: "Page is too large to process (>5MB)" 
        });
      }

      // Security Layer 6: Stream with byte budget to prevent memory exhaustion
      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      const maxBytes = 5 * 1024 * 1024; // 5MB hard limit

      const reader = response.body?.getReader();
      if (!reader) {
        return res.status(500).json({ message: "Failed to read response" });
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          reader.cancel();
          return res.status(400).json({ 
            message: "Page is too large to process (exceeded 5MB while downloading)" 
          });
        }
        chunks.push(value);
      }

      const html = new TextDecoder().decode(Buffer.concat(chunks));
      const $ = cheerio.load(html);

      // Extract product data - Focus on Open Graph tags (most reliable and safe)
      const productData: any = {
        url: url, // Store original URL for future affiliate conversion
        title: '',
        description: '',
        price: '',
        imageUrl: '',
        source: hostname,
      };

      // Strategy 1: Open Graph tags (most reliable for e-commerce)
      productData.title = $('meta[property="og:title"]').attr('content') || 
                         $('meta[name="twitter:title"]').attr('content') || 
                         $('title').text().trim();

      productData.description = $('meta[property="og:description"]').attr('content') || 
                               $('meta[name="description"]').attr('content') || 
                               $('meta[name="twitter:description"]').attr('content') || 
                               '';

      productData.imageUrl = $('meta[property="og:image"]').attr('content') || 
                            $('meta[property="og:image:url"]').attr('content') ||
                            $('meta[name="twitter:image"]').attr('content') || 
                            '';

      // Strategy 2: Price extraction from Open Graph or common patterns
      const ogPrice = $('meta[property="og:price:amount"]').attr('content') ||
                     $('meta[property="product:price:amount"]').attr('content');
      
      if (ogPrice) {
        const currency = $('meta[property="og:price:currency"]').attr('content') || 
                        $('meta[property="product:price:currency"]').attr('content') || 
                        'USD';
        productData.price = currency === 'USD' ? `$${ogPrice}` : `${currency} ${ogPrice}`;
      } else {
        // Try to find price in common e-commerce meta tags and structured data
        const pricePatterns = [
          $('[data-price]').first().attr('data-price'),
          $('[itemprop="price"]').first().attr('content'),
          $('.price').first().text().trim(),
          $('[class*="price"]').first().text().trim(),
        ];

        for (const pattern of pricePatterns) {
          if (pattern && /[\$£€¥]\s*\d+/.test(pattern)) {
            productData.price = pattern.match(/([\$£€¥]\s*[\d,]+\.?\d*)/)?.[0] || '';
            if (productData.price) break;
          }
        }
      }

      // Strategy 3: JSON-LD structured data (secondary approach)
      try {
        $('script[type="application/ld+json"]').each((i, elem) => {
          try {
            const jsonLd = JSON.parse($(elem).html() || '{}');
            if (jsonLd['@type'] === 'Product' || jsonLd['@type']?.includes?.('Product')) {
              if (!productData.title && jsonLd.name) {
                productData.title = jsonLd.name;
              }
              if (!productData.description && jsonLd.description) {
                productData.description = jsonLd.description;
              }
              if (!productData.imageUrl && jsonLd.image) {
                productData.imageUrl = Array.isArray(jsonLd.image) ? jsonLd.image[0] : jsonLd.image;
              }
              if (!productData.price && jsonLd.offers) {
                const offer = Array.isArray(jsonLd.offers) ? jsonLd.offers[0] : jsonLd.offers;
                if (offer.price) {
                  const currency = offer.priceCurrency || 'USD';
                  productData.price = currency === 'USD' ? `$${offer.price}` : `${currency} ${offer.price}`;
                }
              }
            }
          } catch (e) {
            // Skip invalid JSON-LD
          }
        });
      } catch (e) {
        // Continue without JSON-LD data
      }

      // Clean up extracted data
      productData.title = productData.title.substring(0, 200).trim();
      productData.description = productData.description.substring(0, 500).trim();

      // Make relative image URLs absolute
      if (productData.imageUrl && !productData.imageUrl.startsWith('http')) {
        try {
          productData.imageUrl = new URL(productData.imageUrl, url).href;
        } catch {
          productData.imageUrl = '';
        }
      }

      // TODO: Future Affiliate.com API Integration
      // When ready to monetize:
      // 1. Call Affiliate.com API to convert productData.url to affiliate link
      // 2. Store both original URL and affiliate URL
      // 3. Use affiliate URL when displaying "View Product" links
      // 4. Track clicks and conversions for revenue reporting

      console.log(`Product extraction: ${productData.title ? 'success' : 'partial data'} from ${hostname}`);

      res.json(productData);
    } catch (error: any) {
      console.error("Error scraping URL:", error);
      if (error.name === 'AbortError') {
        return res.status(408).json({ message: "Request timeout - URL took too long to respond" });
      }
      res.status(500).json({ message: "Failed to scrape URL. Please check the URL and try again." });
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

  const httpServer = createServer(app);
  return httpServer;
}
