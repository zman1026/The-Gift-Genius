# The Gift Genius

## Overview
A mobile-first web application designed to help families collaboratively create, share, and manage wishlists for any occasion throughout the year. From birthdays and weddings to holidays and celebrations, The Gift Genius makes gift coordination delightful. It streamlines gift coordination by allowing members to add personal wishes, view others' wishlists, and secretly mark items as purchased, ensuring gift surprises are maintained. The application emphasizes quick access to item addition through a persistent floating action button.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application combines Pinterest-style visual cards with Notion-style data presentation, featuring a warm, family-oriented aesthetic. It utilizes Inter and Playfair Display fonts with a festive red and green color scheme. The UI is responsive, employing compact grid layouts (2-6 columns) for wishlist items, featuring square aspect-ratio images, reduced spacing, optimized typography, and priority badge overlays. The design prioritizes mobile with a 4-tab bottom navigation bar and a dashboard optimized for single-column stacking. The "Add Item" button in the bottom navigation is always accessible, intelligently enabled/disabled based on family membership, and meets accessibility standards. The member wishlist page is streamlined, showing display name hierarchy, allowing organizers to rename wishlists, and simplifying interactions to focus on individual item detail sheets. Camera-based product search, powered by SerpApi's Google Lens API, allows users to add products by photographing them.

### Technical Implementations
The frontend uses **React 18**, **TypeScript**, **Wouter** for routing, **TanStack Query v5** for server state, and **Vite**. UI components are built with **shadcn/ui**, **Radix UI**, and **Tailwind CSS**. Form management is handled by **react-hook-form** with **Zod** validation.

The backend is built with **Express.js** and **TypeScript**, using **Drizzle ORM** for database interactions with **Neon Serverless PostgreSQL**. It provides a RESTful JSON API with session-based authentication via **Replit Auth** (Passport.js/OIDC), and all endpoints feature comprehensive **Zod** validation.

### Feature Specifications
- **User Profiles:** Users can update personal information and profile images.
- **Managed Profiles (Child Profiles):** Parents can create wishlist profiles for their children without requiring separate accounts. Child profiles appear seamlessly in the family member list alongside regular users, with parents able to add items to their children's wishlists as organizers. Edit and remove options are available for child profiles created by the current user.
- **Unified Add Item Dialog:** Offers three modes:
    - **Search:** Find products via SerpApi by text or URL, with smart detection for non-product queries.
    - **Camera:** Use device camera for visual product search via Google Lens API.
    - **Manual:** Manually create various item types (product, experience, service, membership, other).
- **Shopping Options:** Simplified viewing of products via Google Shopping.
- **Wishlist Image Upload:** Integrates **Uppy v5** for image uploads to Replit Object Storage (10MB limit).
- **Wishlist Organization:** Items are filterable and sortable by priority and support multiple types.
- **Family Management:** Invite system via email or codes, with organizer controls for renaming families, setting member display names, updating profiles, and removing members.
- **Purchased Items:** A privacy-focused section for users to view their own marked purchases and private notes.
- **Activity Feed:** Real-time tracking of family actions (additions, purchases, new members) displayed on the dashboard.
- **Error Handling:** App-level error boundary with logging to an authenticated endpoint.

### System Design Choices
- **Frontend State:** React Query for server state, custom hooks for logic.
- **Backend API:** RESTful `/api/*` design with structured error handling and input validation.
- **Authentication:** Replit Auth for secure OIDC authentication with session storage.
- **Data Access:** Drizzle ORM for type-safe database operations.
- **Database Schema:** Core tables include `users`, `families`, `family_members`, `events`, `wishlist_items`, `item_purchases`, `activity_logs`, `managed_profiles`, and `sessions` with UUIDs and JSONB metadata for activity logs. The `family_members` and `wishlist_items` tables support both regular users (via `userId`) and managed profiles (via `managedProfileId`), with exactly one field set per row. The `events` table enables multi-occasion support with customizable themes.
- **Event System:** Each family can have multiple events (birthdays, weddings, holidays, etc.) with their own themes, dates, and wishlists. Wishlist items and activity logs are event-scoped for better organization.
- **Security:** Open redirect prevention, robust authorization, and secure cookie management. Authenticated error logging with payload limits.
- **Performance Optimizations:** Server-side caching for SerpApi, optimized search results, database indexes, batched dashboard queries, and smart React Query cache invalidation. API responses use Zod schema validation for robust error handling.

## Recent Architecture Changes (November 2024)

### App Rebranding
- **New Name:** "The Gift Genius" (formerly "Family Christmas Wishlist")
- **Domain:** thegiftgeniusapp.com
- **Purpose:** Expanded from Christmas-only to year-round gift coordination

### Event-Based System
- **Multi-Occasion Support:** Families can now create multiple events (birthdays, weddings, holidays, etc.)
- **Event-Specific Wishlists:** Wishlist items are event-scoped - each event has its own separate wishlist (partial implementation - see status below)
- **Event Themes:** Pre-configured themes for different occasions with customizable colors:
  - Christmas (Red/Green)
  - Birthday (Purple/Gold)
  - Wedding (White/Gold)
  - Baby Shower (Pink/Blue)
  - Hanukkah (Blue/Silver)
  - Graduation (Navy/Gold)
  - Anniversary (Red/White)
  - Holiday (Red/Green)
  - Custom Events (Violet/Pink)

### Database Schema Updates
- **events table:** Stores event details (name, date, type, theme colors, active status)
- **eventId field:** Added to `wishlist_items` and `activity_logs` tables for event scoping
- **Migration:** All existing families migrated to default "Holiday 2024" events

### Backend API Additions
- `GET /api/families/:familyId/events` - List all events for a family
- `POST /api/families/:familyId/events` - Create a new event
- `GET /api/events/:eventId` - Get specific event details
- `PUT /api/events/:eventId` - Update event
- `DELETE /api/events/:eventId` - Delete event (requires at least one event per family)

### Event-Scoping Implementation Status (November 24, 2024)

**✅ COMPLETED - Full Event Isolation (Production Ready):**
- All wishlist query endpoints require and validate eventId with family membership verification
- All item creation, update, and delete endpoints validate event ownership and access
- Purchase endpoints validate event access before allowing purchase operations
- Bulk operations (bulk-delete, bulk-priority) require eventId and validate all items belong to the specified event
- Dashboard queries (stats, activities) filter by selectedEventId when provided
- Frontend passes selectedEventId to all queries and mutations
- UI safeguards: "No event selected" message when user hasn't chosen an event
- Event creation discoverability: Plus icon button when 1 event exists, "Create New Event" option in dropdown when 2+ events exist
- Frontend cache invalidations use proper query keys for event-scoped data
- Data migration completed - all existing items assigned to family default events

**Security:** Complete event isolation enforced. Items from Christmas events cannot be viewed, modified, or deleted when viewing Birthday events. All cross-event access paths have been closed and verified through architect review.

## External Dependencies

-   **Authentication Service:** **Replit Auth** (OpenID Connect via Passport.js)
-   **Database:** **Neon Serverless PostgreSQL**
-   **Email Service:** **Resend** (for invitations)
-   **Product Search:** **SerpApi** (Google Shopping & Google Lens API)
-   **Object Storage:** **Replit Object Storage**
-   **UI Components:** **Radix UI**, **shadcn/ui**, **Tailwind CSS**
-   **File Uploader:** **Uppy v5**
-   **Icons:** **lucide-react**
-   **Date Manipulation:** **date-fns**