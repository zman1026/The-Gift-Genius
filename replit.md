# Family Christmas Wishlist Manager

## Overview
A festive web application enabling families to collaboratively create, share, and manage Christmas wishlists. It allows family members to add personal wishes, view others' wishlists, and secretly mark items as purchased to streamline gift coordination and maintain surprise. The project aims to simplify holiday gift-giving within families.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a hybrid design, combining Pinterest-style visual cards for items with Notion-style organized data presentation. It uses a warm, family-oriented aesthetic with Inter and Playfair Display fonts, and a festive color scheme (primary red, accent green). The UI is responsive, utilizing **compact grid layouts** that adapt from **2-6 columns** for wishlist item displays (2 on mobile, 3 on tablets, 4-6 on desktops), maximizing information density while maintaining readability. Item cards feature **square aspect-ratio images** (aspect-square), **reduced spacing** (gap-3, p-3), **optimized typography** (text-sm titles, text-xs descriptions), and **priority badge overlays** (positioned top-right on thumbnails) to show 2-3x more items per screen while allowing titles to span full width without truncation.

**Mobile-First Redesign (Latest):** The app prioritizes the primary mobile workflow: (1) adding items to wishlist, (2) viewing family members, (3) accessing secondary features. Navigation uses a **3-tab bottom bar** (My List, Family, More) instead of 4 tabs, with **"/" (Dashboard) as the default landing page**. The dashboard is simplified with: (1) countdown + onboarding checklist, (2) 2-column grid for gift progress and budget tracker, (3) compact family groups section. A persistent **Floating Action Button (FAB)** with festive styling (16x16, pulse animation, hover glow, rotating icon) provides quick access to add items from any page. The wishlist page includes a **quick-add banner** with URL paste and search shortcuts for faster item addition. The **members page uses a compact avatar grid** (2-6 columns responsive) showing member avatars, names, item counts, and click-to-view functionality. Secondary features (Dashboard, Search, Purchased Items) are consolidated in a **More page** menu. The redesign reduces navigation friction, increases information density, and optimizes touch targets for mobile users.

**Camera-Based Product Search (Implemented):** The app features camera-based image search using SerpApi's Google Lens API to add products by photographing them in stores.
- **Technology Stack:** HTML5 getUserMedia API for camera capture with MediaStream management, SerpApi Google Lens API for visual product recognition, base64 encoding for efficient image transfer (no storage costs)
- **User Flow:** (1) User opens camera tab in Add Item dialog, (2) Camera permission requested via browser API, (3) Live camera preview with capture button, (4) Photo captured and converted to base64, (5) Image sent to backend endpoint `/api/search/image`, (6) Backend calls SerpApi Lens API, (7) Product results displayed inline with search results, (8) User selects product to add to wishlist
- **Technical Implementation:** 
  - Frontend: `CameraCapture` component with getUserMedia API, ref-based MediaStream management to prevent track leaks, retry flow with proper stream cleanup, facingMode toggle for front/rear cameras, `playsinline` for iOS
  - Backend: POST `/api/search/image` endpoint with comprehensive validation (format, size, Base64 integrity), converts base64 to SerpApi-compatible format, maps Google Lens results to match existing product search schema
- **Validation & Security:** 
  - Client-side: 10MB limit enforced before upload, JPEG/PNG/WebP format validation
  - Server-side: Multi-layer Zod validation extracts and decodes Base64 payload, verifies actual decoded size ≤10MB, rejects malformed or oversized payloads before hitting SerpApi
  - Camera permissions: Browser-managed, no storage of images, immediate base64 conversion
- **Error Handling:** Permission denied errors with clear messaging, device not found fallback, camera in-use detection, retry functionality with proper stream cleanup, graceful degradation on API failures
- **Mobile Optimization:** Responsive camera preview with aspect-video, touch-friendly 64px capture button, camera switch button for devices with multiple cameras, error handling for denied permissions or unavailable cameras, proper MediaStream cleanup to prevent camera lock on retry

### Technical Implementations
The frontend is built with **React 18** and **TypeScript**, using **Wouter** for routing, **TanStack Query v5** for server state, and **Vite** as the build tool. **shadcn/ui** (New York style), **Radix UI** primitives, and **Tailwind CSS** are used for UI components and styling. Form management is handled by **react-hook-form** with **Zod** validation.

The backend uses **Express.js** with **TypeScript**, **Drizzle ORM** for database interactions, and **Neon Serverless PostgreSQL**. It provides a RESTful JSON API with session-based authentication via **Replit Auth** (Passport.js/OIDC). All endpoints feature comprehensive **Zod** validation.

### Feature Specifications
- **User Profiles:** Users can update their firstName, lastName, and profileImageUrl.
- **Unified Add Item Dialog:** Streamlined interface with three modes:
    - **Search:** Search for products or paste URLs to find items via SerpApi with inline results display, error handling, and empty state feedback. Features intelligent query detection that automatically suggests Manual tab for non-product searches (experiences, services, memberships).
    - **Camera:** Take photos of products in stores for instant visual search via Google Lens API. Live camera preview with capture button, front/rear camera toggle, and automatic product recognition. Results displayed inline with same format as text search.
    - **Manual:** Manually create items with support for different types (product, experience, service, membership, other) including experiences like "trip to the zoo" or services like "music lessons"
    - **Smart Search Detection:** Real-time keyword detection using word-boundary regex to identify non-product queries. When users type queries like "disney trip", "music lessons", or "gym membership", a contextual suggestion card appears prompting them to use Manual tab. Includes dismissal state management to prevent suggestion loops and avoid false positives (e.g., "classic" won't trigger "class"). Pre-fills form name and itemType when user accepts suggestion.
- **Shopping Options:** Provides a simplified interface to view products via Google Shopping.
- **Wishlist Image Upload:** Integrates **Uppy v5** for image uploads to Replit Object Storage, with a 10MB file limit.
- **Wishlist Organization:** Items are filterable and sortable by priority (Must-Have, Would Love, Just a Thought). Items support multiple types beyond physical products.
- **Family Management:**
    - **Invite System:** Users can invite family members via email or shareable codes. First-time users see a welcoming screen with "Create Account" and "Already have an account? Login" options. Cookie-based redirect preservation ensures invite codes persist through the OIDC authentication flow.
    - **Organizer Controls:** Family organizers can rename the family, set member-specific display names, update member profiles, and remove members.
- **Purchased Items:** A dedicated, privacy-focused section where users can view only their own marked purchases, including private notes. Purchases are secured with multi-layered backend and frontend checks.
- **Activity Feed:** Real-time activity tracking shows recent family actions including items added/deleted, purchases made, and members joined. The feed appears on the dashboard with user avatars, action icons, and relative timestamps.
- **Error Handling:** App-level error boundary catches and logs frontend errors with multiple recovery options (Try Again, Reload, Sign Out). All errors are logged to an authenticated endpoint with payload limits to prevent abuse.

### System Design Choices
- **Frontend State:** React Query manages server state, while custom hooks encapsulate reusable logic.
- **Backend API:** RESTful design with `/api/*` prefix, structured error handling, and robust input validation.
- **Authentication:** Replit Auth provides secure OIDC authentication with session storage in PostgreSQL.
- **Data Access:** Drizzle ORM ensures type-safe database operations with a clear separation of concerns.
- **Database Schema:** Core tables include `users`, `families`, `family_members`, `wishlist_items`, `item_purchases`, `activity_logs`, and `sessions`, with well-defined relationships and UUID primary keys. Activity logs track user actions with JSONB metadata for flexible audit trails.
- **Security:** Open redirect prevention for invite links, and robust authorization checks for organizer actions. Cookie-based redirect preservation with multi-layer validation: (1) redirect parameters validated on `/api/login` before cookie storage, (2) cookie values revalidated on `/api/callback` before redirect, (3) conditional secure cookies work in both development (HTTP) and production (HTTPS) environments. Error logging endpoint requires authentication with payload length limits (1000 chars for messages, 5000 for stack traces) to prevent spam and log injection attacks.
- **Performance Optimizations:**
    - **Server-Side Caching:** SerpApi product search uses memoizee with 10-minute TTL, background refresh (preFetch), and normalized cache keys for faster repeat searches.
    - **Optimized Search:** Reduced SerpApi results from 20 to 10 items with streamlined payload fields and 10-second request timeout.
    - **Database Indexes:** Dual covering indexes on `family_members(user_id, family_id)` and `family_members(family_id, user_id)` for efficient lookups. Covering index on `wishlist_items(family_id, user_id, priority)` for fast filtered queries. Index on `activity_logs(family_id, created_at)` for efficient activity feed queries.
    - **Batched Queries:** Dashboard stats use single SQL queries with LEFT JOINs and subqueries instead of multiple round-trips.
    - **Smart Cache Invalidation:** React Query staleTime set to 3 minutes, balancing data freshness with reduced server load.
    - **Validated Responses:** Activity feed uses Zod schema validation for API responses to prevent crashes from malformed data, with graceful error handling and retry logic.

## External Dependencies

-   **Authentication Service:** **Replit Auth** (OpenID Connect via Passport.js) for user identity and session management.
-   **Database:** **Neon Serverless PostgreSQL** for persistent data storage, utilizing Drizzle ORM.
-   **Email Service:** **Resend** for sending transactional emails, specifically for family invitations.
-   **Product Search:** **SerpApi** for integrating Google Shopping search functionality, providing location-aware and intelligently prioritized product results.
-   **Object Storage:** **Replit Object Storage** for storing wishlist item images, supporting direct browser uploads and public access control.
-   **UI Components:** **Radix UI** primitives, **shadcn/ui**, **Tailwind CSS**.
-   **File Uploader:** **Uppy v5** for client-side image uploads.
-   **Icons:** **lucide-react**.
-   **Date Manipulation:** **date-fns**.