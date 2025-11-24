# The Gift Genius

## Overview
The Gift Genius is a mobile-first web application designed to facilitate collaborative wishlist management for families across various occasions. It allows users to create, share, and manage wishlists, add items, and secretly mark purchases to preserve gift surprises. The application aims to streamline gift coordination year-round, expanding beyond traditional holiday gift-giving.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application features a warm, family-oriented aesthetic with a responsive design optimized for mobile. It uses a Pinterest-style visual card layout combined with Notion-style data presentation. Key UI elements include a 4-tab bottom navigation bar, an always-accessible "Add Item" button, and a dashboard with an EventHero, QuickActions, MemberSpotlight, GiftCoordination insights, Activity Feed, and an optional Budget Tracker. Navigation and context selection (family/event) are managed via a sidebar menu. Wishlist items are displayed in compact grid layouts with square aspect-ratio images and priority badge overlays.

### Technical Implementations
The frontend is built with **React 18**, **TypeScript**, **Wouter** for routing, **TanStack Query v5** for server state, and **Vite**. UI components leverage **shadcn/ui**, **Radix UI**, and **Tailwind CSS**. Form management uses **react-hook-form** with **Zod** validation.

The backend utilizes **Express.js** and **TypeScript**, with **Drizzle ORM** for database interactions with **Neon Serverless PostgreSQL**. It provides a RESTful JSON API with session-based authentication via **Replit Auth** (Passport.js/OIDC) and comprehensive **Zod** validation for all endpoints.

### Feature Specifications
- **User & Managed Profiles:** Supports individual user profiles and "managed profiles" for children, allowing parents to manage wishlists without separate accounts.
- **Unified Add Item Dialog:** Offers multiple item addition methods: text/URL search (SerpApi), camera-based visual search (Google Lens API), and manual entry.
- **Wishlist Management:** Items are filterable, sortable, and support image uploads via Uppy v5.
- **Family & Event Management:** Includes an invitation system, organizer controls for family settings, and support for multiple, event-specific wishlists (e.g., birthdays, holidays) with customizable themes.
- **Purchase Tracking:** Users can privately mark wishlist items as purchased and log off-wishlist purchases, impacting budget calculations.
- **Activity Feed:** Real-time tracking of family actions.
- **Budget Tracker:** An event-scoped, parent-focused tool for allocating and tracking gift spending per family member, with visual indicators and organizer-only controls.
- **Error Handling:** App-level error boundary with authenticated logging.

### System Design Choices
- **Frontend State:** React Query for server state, custom hooks for logic.
- **Backend API:** RESTful API with structured error handling and Zod validation.
- **Authentication:** Replit Auth for secure OIDC authentication with session storage.
- **Data Access:** Drizzle ORM for type-safe database operations and transactions.
- **Database Schema:** Core tables include `users`, `families`, `family_members`, `events`, `wishlist_items`, `item_purchases`, `activity_logs`, `managed_profiles`, `budget_allocations`, and `sessions`. Key fields like `eventId` enable multi-occasion support and event-scoped data isolation.
- **Security:** Robust authorization with role-based access control, open redirect prevention, secure cookie management, and strict validation for budget modifications.
- **Performance Optimizations:** Server-side caching for external APIs, optimized search, database indexing, batched queries, and smart React Query cache invalidation.

## External Dependencies

-   **Authentication Service:** Replit Auth
-   **Database:** Neon Serverless PostgreSQL
-   **Email Service:** Resend
-   **Product Search:** SerpApi (Google Shopping & Google Lens API)
-   **Object Storage:** Replit Object Storage
-   **UI Components:** Radix UI, shadcn/ui, Tailwind CSS
-   **File Uploader:** Uppy v5
-   **Icons:** lucide-react
-   **Date Manipulation:** date-fns