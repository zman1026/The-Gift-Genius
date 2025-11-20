import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";
import { randomBytes } from "crypto";
import { sendInviteEmail } from "./emailService";
import * as cheerio from "cheerio";

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

  // Product URL extraction route
  app.post('/api/extract-product', isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ message: "Product URL is required" });
      }

      // Validate URL format
      let productUrl: URL;
      try {
        productUrl = new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      // Fetch the page
      const response = await fetch(productUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        return res.status(400).json({ message: "Failed to fetch product page" });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Helper function to clean text
      const cleanText = (text: string | undefined) => text?.trim().replace(/\s+/g, ' ') || '';

      // Extract structured data (JSON-LD)
      let structuredData: any = null;
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const data = JSON.parse($(el).html() || '{}');
          if (data['@type'] === 'Product' || (Array.isArray(data) && data.some((d: any) => d['@type'] === 'Product'))) {
            structuredData = Array.isArray(data) ? data.find((d: any) => d['@type'] === 'Product') : data;
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      // Extract product information with priority fallbacks
      const product: any = {
        name: '',
        price: null,
        description: '',
        imageUrl: '',
      };

      // Extract name
      product.name = cleanText(
        structuredData?.name ||
        $('meta[property="og:title"]').attr('content') ||
        $('meta[name="twitter:title"]').attr('content') ||
        $('h1').first().text() ||
        $('title').text()
      );

      // Extract price
      const priceText = 
        structuredData?.offers?.price ||
        structuredData?.offers?.[0]?.price ||
        $('meta[property="product:price:amount"]').attr('content') ||
        $('[itemprop="price"]').attr('content') ||
        $('[itemprop="price"]').text() ||
        $('.price, .product-price, [data-price]').first().text();
      
      if (priceText) {
        const priceMatch = String(priceText).match(/[\d,.]+/);
        if (priceMatch) {
          product.price = parseFloat(priceMatch[0].replace(/,/g, ''));
        }
      }

      // Extract description
      product.description = cleanText(
        structuredData?.description ||
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        $('meta[name="twitter:description"]').attr('content') ||
        $('[itemprop="description"]').text()
      );

      // Extract image
      product.imageUrl = 
        structuredData?.image ||
        (Array.isArray(structuredData?.image) ? structuredData?.image[0] : null) ||
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        $('[itemprop="image"]').attr('src') ||
        $('img.product-image, img[data-product-image]').first().attr('src') ||
        '';

      // Make image URL absolute if relative
      if (product.imageUrl && !product.imageUrl.startsWith('http')) {
        try {
          product.imageUrl = new URL(product.imageUrl, productUrl.origin).toString();
        } catch (e) {
          console.error('[Extract Product] Failed to make image URL absolute:', e);
          product.imageUrl = ''; // Reset to empty if URL construction fails
        }
      }

      console.log('[Extract Product] URL:', url);
      console.log('[Extract Product] Extracted:', product);

      // Return extracted data
      res.json({
        ...product,
        sourceUrl: productUrl.toString(),
      });
    } catch (error) {
      console.error("Error extracting product from URL:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to extract product information" });
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
      
      // Add location and language parameters for better, faster results
      searchUrl.searchParams.set('location', 'United States');
      searchUrl.searchParams.set('google_domain', 'google.com');
      searchUrl.searchParams.set('hl', 'en');
      searchUrl.searchParams.set('gl', 'us');
      
      // Request more results for better selection
      searchUrl.searchParams.set('num', '20');

      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.error("SerpApi error:", response.status, errorText);
        throw new Error('Search service error');
      }

      const data = await response.json();
      const results = data.shopping_results || [];
      
      console.log(`[Product Search] Query: "${q}" - Found ${results.length} results`);
      if (results.length > 0) {
        console.log(`[Product Search] First result full data:`, JSON.stringify(results[0], null, 2));
      }
      
      // Helper to parse review counts
      const parseReviewCount = (reviews: any) => {
        if (!reviews) return 0;
        const str = String(reviews).toLowerCase();
        if (str.includes('k')) return parseFloat(str) * 1000;
        return parseInt(str.replace(/[^\d]/g, '')) || 0;
      };
      
      // Normalize and sort results by popularity and relevance
      // Prioritize highly rated items with many reviews
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
          
          // Calculate popularity score
          const popularity = rating * Math.log10(reviews + 1);
          
          return {
            ...result,
            link: link, // Ensure link is present
            snippet: result.snippet || result.description || '',
            extracted_price: result.extracted_price || (typeof result.price === 'number' ? result.price : null),
            _popularity: popularity,
            _position: result.position || Infinity,
          };
        })
        .sort((a: any, b: any) => {
          // If both have meaningful popularity scores, use those
          if (a._popularity > 0 || b._popularity > 0) {
            if (a._popularity !== b._popularity) return b._popularity - a._popularity;
          }
          
          // Fallback to position (Google's relevance ordering)
          return a._position - b._position;
        })
        .map(({ _popularity, _position, ...result }: any) => result); // Remove temp fields
      
      res.json(sortedResults);
    } catch (error) {
      console.error("Error searching products:", error);
      res.status(500).json({ message: "Failed to search products" });
    }
  });

  // Shopping options route - Find where to buy a wishlist item
  app.get('/api/wishlist/:id/shopping-options', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      // Get the wishlist item
      const item = await storage.getWishlistItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Verify user has access to this item (is in the same family)
      const familyMember = await storage.getFamilyMember(item.familyId, userId);
      if (!familyMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const apiKey = process.env.SERPAPI_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Shopping service not configured" });
      }

      // Search for the item name
      const searchUrl = new URL('https://serpapi.com/search');
      searchUrl.searchParams.set('engine', 'google_shopping');
      searchUrl.searchParams.set('q', item.name);
      searchUrl.searchParams.set('api_key', apiKey);
      searchUrl.searchParams.set('location', 'United States');
      searchUrl.searchParams.set('google_domain', 'google.com');
      searchUrl.searchParams.set('hl', 'en');
      searchUrl.searchParams.set('gl', 'us');
      searchUrl.searchParams.set('num', '20');

      const response = await fetch(searchUrl.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.error("SerpApi error:", response.status, errorText);
        throw new Error('Shopping service error');
      }

      const data = await response.json();
      const results = data.shopping_results || [];
      
      console.log(`[Shopping Options] Searching for: "${item.name}"`);
      console.log(`[Shopping Options] Found ${results.length} results from SerpApi`);
      if (results.length > 0) {
        console.log(`[Shopping Options] First result full data:`, JSON.stringify(results[0], null, 2));
      }
      
      // Parse and normalize results
      const parseReviewCount = (reviews: any) => {
        if (!reviews) return 0;
        const str = String(reviews).toLowerCase();
        if (str.includes('k')) return parseFloat(str) * 1000;
        return parseInt(str.replace(/[^\d]/g, '')) || 0;
      };
      
      const normalizedResults = results.map((result: any) => {
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
        
        return {
          title: result.title || result.name,
          price: result.extracted_price || result.price || 0,
          link: link,
          source: result.source || result.merchant || 'Unknown Store',
          rating: rating > 0 ? rating : undefined,
          reviews: reviews > 0 ? reviews : undefined,
          thumbnail: result.thumbnail,
          // Calculate reputation score: (rating * log(reviews + 1))
          // This prioritizes stores with both high ratings AND many reviews
          reputationScore: rating * Math.log10(reviews + 1),
        };
      });
      
      console.log(`[Shopping Options] Normalized first result:`, normalizedResults[0]);
      
      // Filter out results without valid links (relaxed filter - don't require price)
      const validResults = normalizedResults.filter((r: any) => r.link);
      
      console.log(`[Shopping Options] ${validResults.length} results after filtering (must have link)`);
      
      // Sort by reputation score (high ratings + many reviews)
      // This ensures we show reputable stores first, not just cheap prices
      const sortedResults = validResults.sort((a: any, b: any) => {
        // Prioritize items with ratings and reviews
        if (a.reputationScore > 0 || b.reputationScore > 0) {
          return b.reputationScore - a.reputationScore;
        }
        // Fallback to price if no reputation data
        return a.price - b.price;
      });
      
      // Return top 10 options
      const topOptions = sortedResults.slice(0, 10).map((r: any) => ({
        title: r.title,
        price: r.price,
        link: r.link,
        source: r.source,
        rating: r.rating,
        reviews: r.reviews,
        thumbnail: r.thumbnail,
      }));
      
      res.json(topOptions);
    } catch (error) {
      console.error("Error fetching shopping options:", error);
      res.status(500).json({ message: "Failed to fetch shopping options" });
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
