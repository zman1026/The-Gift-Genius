# Family Christmas Wishlist Manager

## Overview
A festive web application enabling families to collaboratively create, share, and manage Christmas wishlists. It allows family members to add personal wishes, view others' wishlists, and secretly mark items as purchased to streamline gift coordination and maintain surprise. The project aims to simplify holiday gift-giving within families.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a hybrid design, combining Pinterest-style visual cards for items with Notion-style organized data presentation. It uses a warm, family-oriented aesthetic with Inter and Playfair Display fonts, and a festive color scheme (primary red, accent green). The UI is responsive, utilizing grid layouts that adapt from 1-4 columns for wishlists and 2-4 columns for family members, with consistent spacing. Mobile optimization includes a bottom navigation bar, touch-friendly elements, and PWA support.

### Technical Implementations
The frontend is built with **React 18** and **TypeScript**, using **Wouter** for routing, **TanStack Query v5** for server state, and **Vite** as the build tool. **shadcn/ui** (New York style), **Radix UI** primitives, and **Tailwind CSS** are used for UI components and styling. Form management is handled by **react-hook-form** with **Zod** validation.

The backend uses **Express.js** with **TypeScript**, **Drizzle ORM** for database interactions, and **Neon Serverless PostgreSQL**. It provides a RESTful JSON API with session-based authentication via **Replit Auth** (Passport.js/OIDC). All endpoints feature comprehensive **Zod** validation.

### Feature Specifications
- **User Profiles:** Users can update their firstName, lastName, and profileImageUrl.
- **Product Search & Add:** Allows searching for products via SerpApi, editing details, and adding them to wishlists.
- **Shopping Options:** Provides a simplified interface to view products via Google Shopping.
- **Wishlist Image Upload:** Integrates **Uppy v5** for image uploads to Replit Object Storage, with a 10MB file limit.
- **Wishlist Organization:** Items are filterable and sortable by priority (Must-Have, Would Love, Just a Thought).
- **Family Management:**
    - **Invite System:** Users can invite family members via email or shareable codes. First-time users see a welcoming screen with "Create Account" and "Already have an account? Login" options. Cookie-based redirect preservation ensures invite codes persist through the OIDC authentication flow.
    - **Organizer Controls:** Family organizers can rename the family, set member-specific display names, update member profiles, and remove members.
- **Purchased Items:** A dedicated, privacy-focused section where users can view only their own marked purchases, including private notes. Purchases are secured with multi-layered backend and frontend checks.

### System Design Choices
- **Frontend State:** React Query manages server state, while custom hooks encapsulate reusable logic.
- **Backend API:** RESTful design with `/api/*` prefix, structured error handling, and robust input validation.
- **Authentication:** Replit Auth provides secure OIDC authentication with session storage in PostgreSQL.
- **Data Access:** Drizzle ORM ensures type-safe database operations with a clear separation of concerns.
- **Database Schema:** Core tables include `users`, `families`, `family_members`, `wishlist_items`, `item_purchases`, and `sessions`, with well-defined relationships and UUID primary keys.
- **Security:** Open redirect prevention for invite links, and robust authorization checks for organizer actions. Cookie-based redirect preservation with multi-layer validation: (1) redirect parameters validated on `/api/login` before cookie storage, (2) cookie values revalidated on `/api/callback` before redirect, (3) conditional secure cookies work in both development (HTTP) and production (HTTPS) environments.
- **Performance:** Client-side caching for product searches and efficient image upload mechanisms.

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