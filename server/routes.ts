import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { randomBytes } from "crypto";

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

  // Family members routes
  app.get('/api/members', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const members = await storage.getFamilyMembers(userId);
      res.json(members);
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

      // Don't allow viewing own wishlist this way
      if (userId === viewerId) {
        return res.status(400).json({ message: "Use /api/wishlist to view your own items" });
      }

      const items = await storage.getMemberWishlistItems(userId, viewerId);
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
      const items = await storage.getUserWishlistItems(userId);
      res.json(items);
    } catch (error) {
      console.error("Error fetching wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  app.post('/api/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { name, description, price, url, imageUrl, priority, quantity, category } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      // Get user's first family (or require familyId in request)
      const families = await storage.getUserFamilies(userId);
      if (families.length === 0) {
        return res.status(400).json({ message: "You must join a family before adding wishlist items" });
      }

      const item = await storage.createWishlistItem({
        userId,
        familyId: families[0].id, // Use first family
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
      const { name, description, price, url, imageUrl, productId, source, priority, quantity, category } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      // Get user's first family
      const families = await storage.getUserFamilies(userId);
      if (families.length === 0) {
        return res.status(400).json({ message: "You must join a family before adding wishlist items" });
      }

      const item = await storage.createWishlistItem({
        userId,
        familyId: families[0].id,
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

      const searchUrl = new URL('https://serpapi.com/search');
      searchUrl.searchParams.set('engine', 'google_shopping');
      searchUrl.searchParams.set('q', q);
      searchUrl.searchParams.set('api_key', apiKey);

      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        throw new Error('Search service error');
      }

      const data = await response.json();
      res.json(data.shopping_results || []);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Stats route
  app.get('/api/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await storage.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
