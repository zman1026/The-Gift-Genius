# The Gift Genius

## Overview
The Gift Genius is a mobile-first web application designed to facilitate collaborative wishlist management for groups. It allows users to create, share, and manage wishlists at the group level, add items, and secretly mark purchases to preserve gift surprises. Users can also create personal shareable wishlists for any occasion.

## Recent Changes (November 25, 2025)
- **Event Layer Removal (Phase 3-4)**: Completely removed the Event layer to simplify architecture. The app now focuses on direct group-level wishlist management:
  - Removed EventContext, EventProvider, EventSwitcher, and edit-event.tsx
  - Converted all pages (home, wishlist, member-wishlist, activities, purchased, budget) to group-level operations
  - Updated ActivityFeed, MemberSpotlight, and GiftCoordination components to remove eventId parameters
  - Simplified ThemedMobileHeader to show group name instead of event themes
  - All wishlist queries now use only familyId as the context key
  - Personal lists feature remains independent (uses its own tables)
- **Personal Lists Feature**: Personal shareable wishlists separate from group exchange lists. Users can create personal lists for any occasion (birthday, graduation, wedding, etc.) with custom themes. Each list has a unique public URL (`/lists/:slug`) for sharing.
  - Database: `personal_lists`, `personal_list_items`, and `personal_list_purchases` tables
  - API: Full CRUD at `/api/personal-lists/*`, public list endpoint at `/api/public/lists/:slug`
  - Privacy: List owners cannot see who purchased items
- **UI Terminology Update: "Family" → "Group"**: All user-facing text uses "Group" while internal code (familyId, API routes) remains unchanged for stability.
- **API Migration: SerpApi → Scrapingdog**: Product search uses Scrapingdog for cost savings. Required secret: `SCRAPINGDOG_API_KEY`.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a warm, group-oriented aesthetic with a responsive design optimized for mobile. It uses a Pinterest-style visual card layout combined with Notion-style data presentation. Key UI elements include a 4-tab bottom navigation bar, an always-accessible "Add Item" button, and a dashboard with QuickActions, MemberSpotlight, GiftCoordination insights, Activity Feed, and an optional Budget Tracker. Navigation and context selection (group) are managed via a sidebar menu. Wishlist items are displayed in compact grid layouts with square aspect-ratio images and priority badge overlays. Note: User-facing terminology uses "Group" while internal code uses "family" for stability.

### Technical Implementations
The frontend is built with **React 18**, **TypeScript**, **Wouter** for routing, **TanStack Query v5** for server state, and **Vite**. UI components leverage **shadcn/ui**, **Radix UI**, and **Tailwind CSS**. Form management uses **react-hook-form** with **Zod** validation.

The backend utilizes **Express.js** and **TypeScript**, with **Drizzle ORM** for database interactions with **Neon Serverless PostgreSQL**. It provides a RESTful JSON API with session-based authentication via **Replit Auth** (Passport.js/OIDC) and comprehensive **Zod** validation for all endpoints.

### Feature Specifications
- **User & Managed Profiles:** Supports individual user profiles and "managed profiles" for children, allowing parents to manage wishlists without separate accounts.
- **Unified Add Item Dialog:** Offers multiple item addition methods: text/URL search (Scrapingdog Google Shopping API), camera-based visual search (Scrapingdog Google Lens API), and manual entry.
- **Wishlist Management:** Items are filterable, sortable, and support image uploads via Uppy v5. All wishlists operate at the group level.
- **Group Management:** Includes an invitation system and organizer controls for group settings.
- **Purchase Tracking:** Users can privately mark wishlist items as purchased and log off-wishlist purchases, impacting budget calculations. Wishlist owners never see who purchased their items.
- **Activity Feed:** Real-time tracking of group actions.
- **Budget Tracker:** A group-level, parent-focused tool for allocating and tracking gift spending per group member, with visual indicators and organizer-only controls.
- **Personal Lists:** Independent shareable wishlists for individual occasions with public URLs.
- **Error Handling:** App-level error boundary with authenticated logging.

### System Design Choices
- **Frontend State:** React Query for server state, custom hooks for logic.
- **Backend API:** RESTful API with structured error handling and Zod validation.
- **Authentication:** Replit Auth for secure OIDC authentication with session storage.
- **Data Access:** Drizzle ORM for type-safe database operations and transactions.
- **Database Schema:** Core tables include `users`, `families`, `family_members`, `wishlist_items`, `item_purchases`, `activity_logs`, `managed_profiles`, `budget_allocations`, `personal_lists`, `personal_list_items`, `personal_list_purchases`, and `sessions`.
- **Security:** Robust authorization with role-based access control, open redirect prevention, secure cookie management, and strict validation for budget modifications.
- **Performance Optimizations:** Server-side caching for external APIs, optimized search, database indexing, batched queries, and smart React Query cache invalidation.

## External Dependencies

-   **Authentication Service:** Replit Auth
-   **Database:** Neon Serverless PostgreSQL
-   **Email Service:** Resend
-   **Product Search:** Scrapingdog (Google Shopping API & Google Lens API)
-   **Object Storage:** Replit Object Storage
-   **UI Components:** Radix UI, shadcn/ui, Tailwind CSS
-   **File Uploader:** Uppy v5
-   **Icons:** lucide-react
-   **Date Manipulation:** date-fns
