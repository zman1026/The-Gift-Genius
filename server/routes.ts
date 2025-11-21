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
        name: z.string().trim().min(1, "Family name cannot be empty").optional(),
        budget: z.number().min(0, "Budget must be non-negative").nullable().optional(),
      });

      const validatedData = updateFamilySchema.parse(req.body);
      
      // Convert budget to string for database storage (with 2 decimal places)
      const updates: any = { ...validatedData };
      if (validatedData.budget !== undefined) {
        updates.budget = validatedData.budget !== null ? validatedData.budget.toFixed(2) : null;
      }

      const family = await storage.updateFamily(familyId, updates, userId);
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

      // Check if already purchased
      const existingPurchase = await storage.getItemPurchase(id);
      if (existingPurchase) {
        return res.status(400).json({ message: "This item is already marked as purchased" });
      }

      const purchase = await storage.markItemPurchased({
        itemId: id,
        purchasedById: userId,
        notes: notes || null,
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
