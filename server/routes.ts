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
import { bulkDeleteItemsSchema, bulkUpdatePrioritySchema, setBudgetAllocationsSchema, logOffWishlistPurchaseSchema, insertPersonalListSchema, insertPersonalListItemSchema, occasionTypeEnum } from "@shared/schema";

/**
 * Helper function to compute recipient display name for activity logs
 * Checks family_members.displayName first, then falls back to firstName + lastName
 */
async function getRecipientDisplayName(
  familyId: string,
  userId: string | null,
  managedProfileId: string | null
): Promise<string | null> {
  if (!userId && !managedProfileId) {
    return null;
  }

  const targetId = userId || managedProfileId;
  if (!targetId) {
    return null;
  }

  // Get family member info (includes displayName from family_members table)
  const targetInfo = await storage.getFamilyMemberByAnyId(familyId, targetId);
  if (!targetInfo) {
    return null;
  }

  // If displayName is set in family_members table, use it
  if (targetInfo.member.displayName) {
    return targetInfo.member.displayName;
  }

  // Fall back to firstName + lastName from user or managed profile
  if (targetInfo.matchedField === 'managedProfileId') {
    const profile = await storage.getManagedProfile(targetId);
    if (profile) {
      return `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || null;
    }
  } else {
    const user = await storage.getUser(targetId);
    if (user) {
      return `${user.firstName || ""} ${user.lastName || ""}`.trim() || null;
    }
  }

  return null;
}

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

  // Managed profile (children) routes
  app.post('/api/families/:familyId/children', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { familyId } = req.params;

      const createChildSchema = z.object({
        firstName: z.string().trim().min(1, "First name is required"),
        lastName: z.string().trim().optional(),
        profileImageUrl: z.string().url().optional(),
      });

      const validatedData = createChildSchema.parse(req.body);

      const profile = await storage.createManagedProfile(
        {
          createdById: requesterId,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName || null,
          profileImageUrl: validatedData.profileImageUrl || null,
        },
        familyId
      );
      res.json(profile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error creating child profile:", error);
      res.status(400).json({ message: error.message || "Failed to create child profile" });
    }
  });

  app.put('/api/families/:familyId/children/:childId', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { childId } = req.params;

      const updateChildSchema = z.object({
        firstName: z.string().trim().min(1).optional(),
        lastName: z.string().trim().optional(),
        profileImageUrl: z.string().url().optional(),
      });

      const validatedData = updateChildSchema.parse(req.body);

      const profile = await storage.updateManagedProfile(childId, validatedData, requesterId);
      res.json(profile);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      console.error("Error updating child profile:", error);
      res.status(400).json({ message: error.message || "Failed to update child profile" });
    }
  });

  app.delete('/api/families/:familyId/children/:childId', isAuthenticated, async (req: any, res) => {
    try {
      const requesterId = req.user.claims.sub;
      const { familyId, childId } = req.params;

      await storage.deleteManagedProfile(childId, familyId, requesterId);
      res.json({ message: "Child profile deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting child profile:", error);
      res.status(400).json({ message: error.message || "Failed to delete child profile" });
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
      const viewerId = req.user.claims.sub;
      const { userId } = req.params;
      const { familyId } = req.query;
      
      // Try to fetch as a regular user first
      let user = await storage.getUser(userId);
      let displayName = null;
      
      // If not found as a user, try as a managed profile
      if (!user) {
        const managedProfile = await storage.getManagedProfile(userId);
        if (managedProfile) {
          // Convert managed profile to user-like format
          user = {
            id: managedProfile.id,
            email: null,
            firstName: managedProfile.firstName,
            lastName: managedProfile.lastName,
            profileImageUrl: managedProfile.profileImageUrl,
            createdAt: null,
            updatedAt: null,
          } as any;
        }
      }
      
      if (!user) {
        return res.status(404).json({ message: "Member not found" });
      }

      // If familyId is provided, also get displayName from family_members
      if (familyId && typeof familyId === 'string') {
        const member = await storage.getFamilyMember(familyId, userId);
        if (member) {
          displayName = member.displayName;
        }
      }

      res.json({ ...user, displayName });
    } catch (error) {
      console.error("Error fetching member:", error);
      res.status(500).json({ message: "Failed to fetch member" });
    }
  });

  app.get('/api/members/:userId/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const viewerId = req.user.claims.sub;
      const { userId } = req.params;
      const { familyId, eventId } = req.query;

      // Don't allow viewing own wishlist this way
      if (userId === viewerId) {
        return res.status(400).json({ message: "Use /api/wishlist to view your own items" });
      }

      // eventId is required for event-scoped wishlists
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ message: "Event ID is required" });
      }

      // Verify event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify viewer is a member of the event's family
      const membership = await storage.getFamilyMember(event.familyId, viewerId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      const items = await storage.getMemberWishlistItems(
        userId, 
        viewerId, 
        familyId as string | undefined,
        eventId
      );
      res.json(items);
    } catch (error) {
      console.error("Error fetching member wishlist:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  // Event routes
  app.get('/api/families/:familyId/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;
      const { activeOnly } = req.query;

      // Verify user is a member of the family
      const membership = await storage.getFamilyMember(familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You must be a family member to view events" });
      }

      const events = activeOnly === 'true' 
        ? await storage.getActiveEventsByFamily(familyId)
        : await storage.getEventsByFamily(familyId);
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.post('/api/families/:familyId/events', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId } = req.params;

      // Verify user is the family organizer (only organizers can create events)
      const family = await storage.getFamily(familyId);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }
      if (family.createdById !== userId) {
        return res.status(403).json({ message: "Only the family organizer can create events" });
      }

      // Validate input with Zod schema
      const createEventSchema = z.object({
        name: z.string().min(1, "Event name is required").max(255),
        date: z.string().datetime().optional().nullable(),
        eventType: z.enum(['christmas', 'birthday', 'wedding', 'baby_shower', 'hanukkah', 'graduation', 'anniversary', 'holiday', 'other']),
        themePrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
        themeAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").optional(),
        isActive: z.boolean().optional(),
      });

      const validatedData = createEventSchema.parse(req.body);

      const event = await storage.createEvent({
        ...validatedData,
        date: validatedData.date ? new Date(validatedData.date) : null,
        familyId,
      });

      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.get('/api/events/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user is a member of the event's family
      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You must be a family member to view this event" });
      }

      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.put('/api/events/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      // Validate input
      const updateEventSchema = z.object({
        name: z.string().min(1).max(255).optional(),
        date: z.string().datetime().optional().nullable(),
        eventType: z.enum(['christmas', 'birthday', 'wedding', 'baby_shower', 'hanukkah', 'graduation', 'anniversary', 'holiday', 'other']).optional(),
        themePrimary: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        themeAccent: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        isActive: z.boolean().optional(),
      });

      const validatedData = updateEventSchema.parse(req.body);

      // Convert date string to Date object if present
      const updates: any = { ...validatedData };
      if (validatedData.date !== undefined) {
        updates.date = validatedData.date ? new Date(validatedData.date) : null;
      }

      const event = await storage.updateEvent(eventId, updates, userId);
      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete('/api/events/:eventId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      await storage.deleteEvent(eventId, event.familyId, userId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes("Cannot delete the last event")) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Budget routes
  app.get('/api/events/:eventId/budget', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      // Verify event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user is a member of the event's family
      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      const budgetData = await storage.getEventBudgetOverview(eventId);
      res.json(budgetData);
    } catch (error) {
      console.error("Error getting budget overview:", error);
      res.status(500).json({ message: "Failed to get budget overview" });
    }
  });

  app.put('/api/events/:eventId/budget/allocations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { eventId } = req.params;

      // Verify event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Verify user is an organizer of the event's family
      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      const family = await storage.getFamily(event.familyId);
      if (!family) {
        return res.status(404).json({ message: "Family not found" });
      }

      if (family.createdById !== userId) {
        return res.status(403).json({ message: "Only family organizers can set budget allocations" });
      }

      // Validate payload with Zod
      const validatedData = setBudgetAllocationsSchema.parse(req.body);

      // Verify all allocation targets belong to the event's family
      const familyMembersData = await storage.getFamilyMembersByFamilyId(event.familyId);
      const familyMemberIds = new Set<string>();
      
      // Build set of valid member IDs (both userId and managedProfileId)
      for (const member of familyMembersData) {
        if (member.userId) familyMemberIds.add(member.userId);
        if (member.managedProfileId) familyMemberIds.add(member.managedProfileId);
      }

      // Validate each allocation target exists in the family
      for (const allocation of validatedData.allocations) {
        const targetId = allocation.userId || allocation.managedProfileId;
        
        // Explicitly reject if targetId is falsy (shouldn't happen due to Zod, but extra safety)
        if (!targetId || typeof targetId !== 'string' || targetId.trim() === '') {
          return res.status(400).json({ 
            message: "Invalid allocation: each allocation must have a valid userId or managedProfileId" 
          });
        }
        
        // Verify the target is a member of this family
        if (!familyMemberIds.has(targetId)) {
          return res.status(400).json({ 
            message: "All budget allocations must be for members of this event's family" 
          });
        }
      }

      await storage.setBudgetAllocations(eventId, validatedData.allocations);
      const updatedBudget = await storage.getEventBudgetOverview(eventId);
      res.json(updatedBudget);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid budget allocation data", errors: error.errors });
      }
      console.error("Error setting budget allocations:", error);
      res.status(500).json({ message: "Failed to set budget allocations" });
    }
  });

  // Wishlist routes
  app.get('/api/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId, eventId, sort, order, priority, itemType } = req.query;
      
      // eventId is required for event-scoped wishlists
      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ message: "Event ID is required" });
      }
      
      // Validate and sanitize query params
      const validSorts = ['name', 'price', 'priority', 'createdAt'];
      const validOrders = ['asc', 'desc'];
      const validPriorities = ['high', 'medium', 'low'];
      const validItemTypes = ['product', 'experience', 'service', 'membership', 'other'];
      
      // Verify event exists and user has access via family membership
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Verify user is a member of the event's family
      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }
      
      // Build filter options with validation
      const options = {
        eventId,
        sort: sort && validSorts.includes(sort as string) ? (sort as 'name' | 'price' | 'priority' | 'createdAt') : undefined,
        order: order && validOrders.includes(order as string) ? (order as 'asc' | 'desc') : undefined,
        priority: priority && validPriorities.includes(priority as string) ? (priority as 'high' | 'medium' | 'low') : undefined,
        itemType: itemType && validItemTypes.includes(itemType as string) ? (itemType as 'product' | 'experience' | 'service' | 'membership' | 'other') : undefined,
      };
      
      if (familyId && typeof familyId === 'string') {
        // Verify familyId matches event's family
        if (familyId !== event.familyId) {
          return res.status(400).json({ message: "Event does not belong to this family" });
        }
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
      const { name, description, price, url, imageUrl, priority, quantity, category, itemType, familyId, eventId, override } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ message: "Event ID is required" });
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

      // Verify event exists and belongs to the family
      const event = await storage.getEvent(eventId);
      if (!event || event.familyId !== targetFamilyId) {
        return res.status(400).json({ message: "Invalid event for this family" });
      }

      // Check for duplicate items by URL (if provided and not overriding)
      if (url && !override) {
        const duplicate = await storage.findDuplicateWishlistItem(userId, targetFamilyId, eventId, url);
        if (duplicate) {
          return res.status(409).json({ 
            message: "This item is already on your wishlist for this event",
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
        eventId,
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

      // Compute recipient display name for activity log
      const recipientDisplayName = await getRecipientDisplayName(
        targetFamilyId,
        item.userId,
        item.managedProfileId
      );

      // Log activity
      await storage.createActivityLog({
        familyId: targetFamilyId,
        eventId,
        actorId: userId,
        action: "item_added",
        itemId: item.id,
        metadata: {
          itemName: name,
          priority: priority || "medium",
          itemType: itemType || "product",
          recipientUserId: item.userId,
          recipientManagedProfileId: item.managedProfileId,
          recipientDisplayName,
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
      const { name, description, price, url, imageUrl, productId, source, priority, quantity, category, itemType, familyId, eventId, override } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ message: "Event ID is required" });
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

      // Verify event exists and belongs to the family
      const event = await storage.getEvent(eventId);
      if (!event || event.familyId !== targetFamilyId) {
        return res.status(400).json({ message: "Invalid event for this family" });
      }

      // Check for duplicate items by URL or productId (if provided and not overriding)
      if ((url || productId) && !override) {
        const duplicate = await storage.findDuplicateWishlistItem(userId, targetFamilyId, eventId, url, productId);
        if (duplicate) {
          return res.status(409).json({ 
            message: "This item is already on your wishlist for this event",
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
        eventId,
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

      // Compute recipient display name for activity log
      const recipientDisplayName = await getRecipientDisplayName(
        targetFamilyId,
        item.userId,
        item.managedProfileId
      );

      // Log activity
      await storage.createActivityLog({
        familyId: targetFamilyId,
        eventId,
        actorId: userId,
        action: "item_added",
        itemId: item.id,
        metadata: {
          itemName: name,
          priority: priority || "medium",
          itemType: itemType || "product",
          source: source || "google_shopping",
          recipientUserId: item.userId,
          recipientManagedProfileId: item.managedProfileId,
          recipientDisplayName,
        },
      });

      res.json(item);
    } catch (error) {
      console.error("Error adding item from search:", error);
      res.status(500).json({ message: "Failed to add item" });
    }
  });

  // Organizer-only: Add wishlist item to any member's wishlist (including child profiles)
  app.post('/api/families/:familyId/members/:targetUserId/wishlist', isAuthenticated, async (req: any, res) => {
    try {
      const organizerId = req.user.claims.sub;
      const { familyId, targetUserId } = req.params;
      const { name, description, price, url, imageUrl, productId, source, priority, quantity, category, eventId } = req.body;

      if (!name || typeof name !== 'string') {
        return res.status(400).json({ message: "Item name is required" });
      }

      if (!eventId || typeof eventId !== 'string') {
        return res.status(400).json({ message: "Event ID is required" });
      }

      // Verify requester is the organizer of the family
      const family = await storage.getFamily(familyId);
      if (!family || family.createdById !== organizerId) {
        return res.status(403).json({ message: "Only the family organizer can add items to other members' wishlists" });
      }

      // Verify event exists and belongs to the family
      const event = await storage.getEvent(eventId);
      if (!event || event.familyId !== familyId) {
        return res.status(400).json({ message: "Invalid event for this family" });
      }

      // Verify target is a member of the family (could be user or managed profile)
      const targetInfo = await storage.getFamilyMemberByAnyId(familyId, targetUserId);
      if (!targetInfo) {
        return res.status(404).json({ message: "Target member not found in this family" });
      }

      // Create item with correct field based on which field matched
      const itemData: any = {
        familyId,
        eventId,
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
      };

      // Set exactly one of userId or managedProfileId based on matched field
      if (targetInfo.matchedField === 'managedProfileId') {
        itemData.managedProfileId = targetUserId;
        itemData.userId = null;
      } else {
        itemData.userId = targetUserId;
        itemData.managedProfileId = null;
      }

      const item = await storage.createWishlistItem(itemData);

      // Compute recipient display name for activity log
      const recipientDisplayName = await getRecipientDisplayName(
        familyId,
        item.userId,
        item.managedProfileId
      );

      // Log activity with recipient information
      await storage.createActivityLog({
        familyId,
        eventId,
        actorId: organizerId,
        action: "item_added",
        itemId: item.id,
        metadata: {
          itemName: name,
          priority: priority || "medium",
          itemType: category || "product",
          recipientUserId: item.userId,
          recipientManagedProfileId: item.managedProfileId,
          recipientDisplayName,
        },
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

      // Verify item has an eventId
      if (!item.eventId) {
        return res.status(400).json({ message: "Item is not associated with an event" });
      }

      // Verify event exists and user has access via family membership
      const event = await storage.getEvent(item.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
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

      // Verify item has an eventId
      if (!item.eventId) {
        return res.status(400).json({ message: "Item is not associated with an event" });
      }

      // Verify event exists and user has access via family membership
      const event = await storage.getEvent(item.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      // Log activity before deletion (with eventId)
      await storage.createActivityLog({
        familyId: item.familyId,
        eventId: item.eventId,
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

      const { itemIds, familyId, eventId } = parsed.data;

      // Verify event exists and belongs to the family
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.familyId !== familyId) {
        return res.status(403).json({ message: "Event does not belong to this family" });
      }

      // Verify user is a member of the event's family
      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      // Delete items (storage layer will verify all items belong to the same event)
      const deletedItems = await storage.bulkDeleteWishlistItems(userId, familyId, itemIds, eventId);

      // Log activity for each deleted item (with eventId)
      for (const item of deletedItems) {
        await storage.createActivityLog({
          familyId: item.familyId,
          eventId: item.eventId || undefined,
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

      const { itemIds, priority, familyId, eventId } = parsed.data;

      // Verify event exists and belongs to the family
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.familyId !== familyId) {
        return res.status(403).json({ message: "Event does not belong to this family" });
      }

      // Verify user is a member of the event's family
      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      // Update items (storage layer will verify all items belong to the same event)
      const updatedItems = await storage.bulkUpdateWishlistPriority(userId, familyId, itemIds, priority, eventId);

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

      // Verify item has an eventId
      if (!item.eventId) {
        return res.status(400).json({ message: "Item is not associated with an event" });
      }

      // Verify event exists and user has access via family membership
      const event = await storage.getEvent(item.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      // Check if this user has already purchased this item
      const existingUserPurchase = await storage.getUserPurchaseForItem(id, userId);
      if (existingUserPurchase) {
        return res.status(400).json({ message: "You have already marked this item as purchased" });
      }

      // Create snapshot of item to preserve details even if deleted later
      const itemSnapshot = JSON.stringify({
        name: item.name,
        description: item.description,
        price: item.price,
        url: item.url,
        imageUrl: item.imageUrl,
        priority: item.priority,
        quantity: item.quantity,
        category: item.category,
      });

      const purchase = await storage.markItemPurchased({
        itemId: id,
        eventId: item.eventId,
        purchasedById: userId,
        notes: notes || null,
        itemSnapshot,
      });

      // Log activity with eventId
      await storage.createActivityLog({
        familyId: item.familyId,
        eventId: item.eventId,
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

      // Get item data for security verification and activity log
      const item = await storage.getWishlistItem(id);
      if (!item) {
        return res.status(404).json({ message: "Item not found" });
      }

      // Verify item has an eventId
      if (!item.eventId) {
        return res.status(400).json({ message: "Item is not associated with an event" });
      }

      // Verify event exists and user has access via family membership
      const event = await storage.getEvent(item.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const membership = await storage.getFamilyMember(event.familyId, userId);
      if (!membership) {
        return res.status(403).json({ message: "You are not a member of this event's family" });
      }

      // Log activity with eventId before unmarking
      await storage.createActivityLog({
        familyId: item.familyId,
        eventId: item.eventId,
        actorId: userId,
        targetUserId: item.userId,
        itemId: id,
        action: "item_unpurchased",
        metadata: {
          itemName: item.name,
        },
      });

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
      const { familyId, eventId } = req.query;
      
      console.log('[DEBUG] GET /api/purchases called:', { userId, familyId, eventId });

      if (!familyId || typeof familyId !== 'string') {
        return res.status(400).json({ message: "familyId is required" });
      }

      const isMember = await storage.getFamilyMember(familyId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are not a member of this family" });
      }

      const purchases = await storage.getPurchasedItemsByUser(
        userId, 
        familyId, 
        eventId && typeof eventId === 'string' ? eventId : undefined
      );
      
      console.log('[DEBUG] Purchases found:', purchases.length);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching purchased items:", error);
      res.status(500).json({ message: "Failed to fetch purchased items" });
    }
  });

  // Log off-wishlist purchase (gifts bought outside the wishlist)
  app.post('/api/purchases/off-list', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body using Zod schema
      const validation = logOffWishlistPurchaseSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid purchase data", 
          errors: validation.error.errors 
        });
      }

      const purchase = await storage.logOffWishlistPurchase(validation.data, userId);
      res.status(201).json(purchase);
    } catch (error) {
      console.error("Error logging off-wishlist purchase:", error);
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      res.status(500).json({ message: "Failed to log purchase" });
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
  // Uses Scrapingdog Google Shopping API (10 credits per request)
  const cachedProductSearch = memoize(
    async (query: string, apiKey: string) => {
      const searchUrl = new URL('https://api.scrapingdog.com/google_shopping');
      searchUrl.searchParams.set('api_key', apiKey);
      searchUrl.searchParams.set('query', query);
      searchUrl.searchParams.set('country', 'us');
      searchUrl.searchParams.set('results', '10');

      const response = await fetch(searchUrl.toString(), { signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Scrapingdog error:", response.status, errorText);
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

  // Product search route (Scrapingdog Google Shopping integration)
  app.get('/api/search', isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query is required" });
      }

      const apiKey = process.env.SCRAPINGDOG_API_KEY;
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

  // Image search route (Google Lens via Scrapingdog - 5 credits per request)
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

      const apiKey = process.env.SCRAPINGDOG_API_KEY;
      if (!apiKey) {
        console.error("SCRAPINGDOG_API_KEY environment variable not set");
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

      // Call Scrapingdog Google Lens API with the public URL
      // Scrapingdog expects the URL in a specific format for Google Lens
      const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
      const searchUrl = new URL('https://api.scrapingdog.com/google_lens');
      searchUrl.searchParams.set('api_key', apiKey);
      searchUrl.searchParams.set('url', lensUrl);
      
      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(20000), // 20 second timeout for image processing
      });

      console.log(`Scrapingdog response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        const truncatedError = errorText.substring(0, 500);
        console.error(`Scrapingdog Google Lens error: ${response.status} - ${truncatedError}`);
        
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
      console.log(`Scrapingdog response keys: ${Object.keys(data).join(', ')}`);
      
      // Check for error in response
      if (data.error) {
        console.error(`Scrapingdog error: ${JSON.stringify(data.error)}`);
      }
      
      // Scrapingdog returns lens_results array
      const lensResults = data.lens_results || [];
      console.log(`lens_results count: ${lensResults.length}`);
      
      // Log first result if available
      if (lensResults[0]) {
        console.log(`First lens result: ${JSON.stringify(lensResults[0]).substring(0, 200)}`);
      }
      
      // Format Scrapingdog lens results to match our existing product format
      const results = lensResults.slice(0, 10).map((result: any, index: number) => ({
        position: result.position || index + 1,
        title: result.title,
        link: result.link,
        product_link: result.link,
        source: result.source || 'Google Lens',
        price: result.tag, // Scrapingdog returns price in 'tag' field
        extracted_price: result.tag ? parseFloat(result.tag.replace(/[^0-9.]/g, '')) : undefined,
        thumbnail: result.thumbnail,
        rating: undefined,
        reviews: undefined,
        snippet: undefined,
        in_stock: result.in_stock,
      }));

      console.log(`Image search successful: ${results.length} results found`);
      
      // Clean up the temporary file after sending response (best effort)
      // Wait a bit to ensure Scrapingdog had time to fetch it
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
      const { familyId, eventId } = req.query;
      
      if (familyId && typeof familyId === 'string') {
        // Convert empty string to undefined to avoid SQL errors
        const validEventId = eventId && typeof eventId === 'string' && eventId.trim() !== '' ? eventId : undefined;
        const stats = await storage.getUserStatsByFamily(userId, familyId, validEventId);
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

  // Member item counts route
  app.get('/api/wishlist/member-counts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId, eventId } = req.query;
      
      if (!familyId || typeof familyId !== 'string') {
        return res.status(400).json({ message: "Family ID is required" });
      }
      
      // Convert empty string to undefined to avoid SQL errors
      const validEventId = eventId && typeof eventId === 'string' && eventId.trim() !== '' ? eventId : undefined;
      const counts = await storage.getMemberItemCounts(userId, familyId, validEventId);
      res.json(counts);
    } catch (error) {
      console.error("Error fetching member counts:", error);
      if ((error as Error).message === "You are not a member of this family") {
        return res.status(403).json({ message: "You are not a member of this family" });
      }
      res.status(500).json({ message: "Failed to fetch member counts" });
    }
  });

  // Coordination insights route
  app.get('/api/coordination-insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { familyId, eventId } = req.query;
      
      if (!familyId || typeof familyId !== 'string') {
        return res.status(400).json({ message: "Family ID is required" });
      }
      
      // Convert empty string to undefined to avoid SQL errors
      const validEventId = eventId && typeof eventId === 'string' && eventId.trim() !== '' ? eventId : undefined;
      const insights = await storage.getCoordinationInsights(userId, familyId, validEventId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching coordination insights:", error);
      if ((error as Error).message === "You are not a member of this family") {
        return res.status(403).json({ message: "You are not a member of this family" });
      }
      if ((error as Error).message === "Event not found or does not belong to this family") {
        return res.status(404).json({ message: "Event not found or does not belong to this family" });
      }
      res.status(500).json({ message: "Failed to fetch coordination insights" });
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
      const { familyId, eventId, limit } = req.query;
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
        limit ? parseInt(limit as string) : 10,
        eventId as string | undefined
      );

      res.json(activities);
    } catch (error) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // ============================================
  // Personal Lists Routes
  // ============================================

  // Get all personal lists for the current user
  app.get('/api/personal-lists', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const lists = await storage.getUserPersonalLists(userId);
      res.json(lists);
    } catch (error) {
      console.error("Error fetching personal lists:", error);
      res.status(500).json({ message: "Failed to fetch personal lists" });
    }
  });

  // Create a new personal list
  app.post('/api/personal-lists', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const createSchema = z.object({
        name: z.string().min(1, "Name is required").max(255),
        occasionType: occasionTypeEnum,
        description: z.string().optional(),
        date: z.string().optional().transform((val) => val ? new Date(val) : undefined),
        themeColors: z.object({
          primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
          accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
          background: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
        }).optional(),
        publicSlug: z.string().max(120).optional(),
      });

      const validatedData = createSchema.parse(req.body);
      
      // Generate a unique public slug if not provided
      let slug = validatedData.publicSlug;
      if (!slug) {
        const baseSlug = validatedData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 50);
        const uniqueId = randomBytes(4).toString('hex');
        slug = `${baseSlug}-${uniqueId}`;
      }

      // Check if slug is already taken
      const existingList = await storage.getPersonalListBySlug(slug);
      if (existingList) {
        return res.status(400).json({ message: "This URL slug is already taken" });
      }

      const list = await storage.createPersonalList({
        ...validatedData,
        userId,
        publicSlug: slug,
      });

      res.status(201).json(list);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid list data", errors: error.errors });
      }
      console.error("Error creating personal list:", error);
      res.status(500).json({ message: "Failed to create personal list" });
    }
  });

  // Get a specific personal list with items
  app.get('/api/personal-lists/:listId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listId } = req.params;

      const listWithItems = await storage.getPersonalListWithItems(listId, userId);
      res.json(listWithItems);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error fetching personal list:", error);
      res.status(500).json({ message: "Failed to fetch personal list" });
    }
  });

  // Update a personal list
  app.put('/api/personal-lists/:listId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listId } = req.params;

      const updateSchema = z.object({
        name: z.string().min(1).max(255).optional(),
        occasionType: occasionTypeEnum.optional(),
        description: z.string().optional(),
        date: z.string().optional().transform((val) => val ? new Date(val) : undefined),
        themeColors: z.object({
          primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
          accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
          background: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
        }).optional(),
        publicSlug: z.string().max(120).optional(),
      });

      const validatedData = updateSchema.parse(req.body);

      // If updating slug, check it's not taken
      if (validatedData.publicSlug) {
        const existingList = await storage.getPersonalListBySlug(validatedData.publicSlug);
        if (existingList && existingList.id !== listId) {
          return res.status(400).json({ message: "This URL slug is already taken" });
        }
      }

      const updatedList = await storage.updatePersonalList(listId, validatedData, userId);
      res.json(updatedList);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid list data", errors: error.errors });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error updating personal list:", error);
      res.status(500).json({ message: "Failed to update personal list" });
    }
  });

  // Delete a personal list
  app.delete('/api/personal-lists/:listId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listId } = req.params;

      await storage.deletePersonalList(listId, userId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error deleting personal list:", error);
      res.status(500).json({ message: "Failed to delete personal list" });
    }
  });

  // ============================================
  // Personal List Items Routes
  // ============================================

  // Add item to personal list
  app.post('/api/personal-lists/:listId/items', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { listId } = req.params;

      // Verify the list exists and belongs to the user
      const list = await storage.getPersonalList(listId);
      if (!list) {
        return res.status(404).json({ message: "Personal list not found" });
      }
      if (list.userId !== userId) {
        return res.status(403).json({ message: "You can only add items to your own lists" });
      }

      const createItemSchema = z.object({
        name: z.string().min(1, "Name is required").max(255),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        imageUrl: z.string().url().optional().or(z.literal("")),
        link: z.string().url().optional().or(z.literal("")),
        priority: z.enum(["high", "medium", "low"]).optional(),
        quantity: z.number().int().min(1).optional(),
      });

      const validatedData = createItemSchema.parse(req.body);

      const item = await storage.createPersonalListItem({
        ...validatedData,
        listId,
        price: validatedData.price?.toString(),
        imageUrl: validatedData.imageUrl || null,
        link: validatedData.link || null,
      });

      res.status(201).json(item);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      console.error("Error adding personal list item:", error);
      res.status(500).json({ message: "Failed to add item" });
    }
  });

  // Update personal list item
  app.patch('/api/personal-lists/:listId/items/:itemId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      const updateItemSchema = z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        price: z.number().min(0).optional(),
        imageUrl: z.string().url().optional().or(z.literal("")),
        link: z.string().url().optional().or(z.literal("")),
        priority: z.enum(["high", "medium", "low"]).optional(),
        quantity: z.number().int().min(1).optional(),
      });

      const validatedData = updateItemSchema.parse(req.body);

      const updatedItem = await storage.updatePersonalListItem(itemId, {
        ...validatedData,
        price: validatedData.price?.toString(),
        imageUrl: validatedData.imageUrl !== undefined ? (validatedData.imageUrl || null) : undefined,
        link: validatedData.link !== undefined ? (validatedData.link || null) : undefined,
      }, userId);

      res.json(updatedItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid item data", errors: error.errors });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error updating personal list item:", error);
      res.status(500).json({ message: "Failed to update item" });
    }
  });

  // Delete personal list item
  app.delete('/api/personal-lists/:listId/items/:itemId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      await storage.deletePersonalListItem(itemId, userId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error deleting personal list item:", error);
      res.status(500).json({ message: "Failed to delete item" });
    }
  });

  // ============================================
  // Personal List Purchase Routes
  // ============================================

  // Mark item as purchased
  app.post('/api/personal-lists/:listId/items/:itemId/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      const purchase = await storage.markPersonalListItemPurchased(itemId, userId);
      // Return redacted response - don't expose purchasedByUserId for privacy
      res.status(201).json({ 
        itemId: purchase.itemId,
        purchasedAt: purchase.purchasedAt,
        success: true
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      if (error instanceof Error && error.message.includes("already been purchased")) {
        return res.status(409).json({ message: error.message });
      }
      console.error("Error marking item as purchased:", error);
      res.status(500).json({ message: "Failed to mark item as purchased" });
    }
  });

  // Unmark item as purchased
  app.delete('/api/personal-lists/:listId/items/:itemId/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { itemId } = req.params;

      await storage.unmarkPersonalListItemPurchased(itemId, userId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: error.message });
      }
      if (error instanceof AuthorizationError) {
        return res.status(403).json({ message: error.message });
      }
      console.error("Error unmarking item as purchased:", error);
      res.status(500).json({ message: "Failed to unmark item as purchased" });
    }
  });

  // ============================================
  // Public Personal List Routes (no auth)
  // ============================================

  // Get public personal list by slug
  app.get('/api/public/lists/:slug', async (req, res) => {
    try {
      const { slug } = req.params;

      const listWithItems = await storage.getPublicPersonalList(slug);
      res.json(listWithItems);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({ message: "List not found" });
      }
      console.error("Error fetching public personal list:", error);
      res.status(500).json({ message: "Failed to fetch list" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
