# Family Christmas Wishlist Manager

## Overview
A mobile-first web application designed to help families collaboratively create, share, and manage Christmas wishlists. It streamlines gift coordination by allowing members to add personal wishes, view others' wishlists, and secretly mark items as purchased, ensuring gift surprises are maintained. The application emphasizes quick access to item addition through a persistent floating action button.

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
- **Database Schema:** Core tables include `users`, `families`, `family_members`, `wishlist_items`, `item_purchases`, `activity_logs`, and `sessions` with UUIDs and JSONB metadata for activity logs.
- **Security:** Open redirect prevention, robust authorization, and secure cookie management. Authenticated error logging with payload limits.
- **Performance Optimizations:** Server-side caching for SerpApi, optimized search results, database indexes, batched dashboard queries, and smart React Query cache invalidation. API responses use Zod schema validation for robust error handling.

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