# Family Christmas Wishlist Manager

## Overview

A festive web application for families to create, share, and coordinate Christmas wishlists. Family members can create personal wishlists, view each other's wishes, and secretly mark items as purchased to coordinate gift-giving without spoiling surprises.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **React 18** with TypeScript for type-safe component development
- **Wouter** for lightweight client-side routing
- **TanStack Query v5** for server state management and data fetching
- **Vite** as the build tool and development server

**UI Framework:**
- **shadcn/ui** component library (New York style variant)
- **Radix UI** primitives for accessible, unstyled components
- **Tailwind CSS** for utility-first styling with custom CSS variables for theming
- **class-variance-authority** and **clsx** for dynamic className management

**Design System:**
- Hybrid approach combining Pinterest-style visual cards with Notion-style organized data
- Typography: Inter (body/UI) and Playfair Display (headings) for warm, family-oriented aesthetic
- Festive color scheme with primary red (`--primary: 355 70% 50%`) and accent green (`--accent: 140 40% 35%`)
- Responsive grid layouts: 1-4 columns for wishlists, 2-4 columns for family members
- Consistent spacing using Tailwind's 2/4/6/8/12/16 unit system

**State Management:**
- React Query handles all server state with infinite stale time
- Custom hooks (`useAuth`, `useIsMobile`, `useToast`) encapsulate reusable logic
- Form state managed via react-hook-form with Zod schema validation

### Backend Architecture

**Technology Stack:**
- **Express.js** as the HTTP server framework
- **TypeScript** throughout the entire codebase
- **Drizzle ORM** for type-safe database operations
- **Neon Serverless PostgreSQL** as the database provider

**API Design:**
- RESTful JSON API with `/api/*` prefix
- Session-based authentication using express-session with PostgreSQL store
- Request/response logging middleware for debugging
- Structured error handling with appropriate HTTP status codes

**Authentication:**
- **Replit Auth** using OpenID Connect (OIDC) via Passport.js
- Session storage in PostgreSQL with 7-day TTL
- Protected routes use `isAuthenticated` middleware
- User claims stored in session include access/refresh tokens

**Data Access Layer:**
- Storage interface (`IStorage`) abstracts database operations
- Drizzle schema defines strongly-typed table structures
- Relations defined for users, families, family members, wishlist items, and purchases
- UUID primary keys generated via `gen_random_uuid()`

### Database Schema

**Core Tables:**
- `users` - User profiles from Replit Auth (email, firstName, lastName, profileImageUrl)
- `families` - Family groups with unique invite codes
- `family_members` - Junction table linking users to families with display names
- `wishlist_items` - Individual wishlist entries with name, description, price, URL, imageUrl, priority, quantity, category
- `item_purchases` - Tracks who purchased which items with optional notes (hidden from item owner)
- `sessions` - Express session storage (required for Replit Auth)

**Key Relationships:**
- Users have many family memberships and wishlist items
- Families have many members
- Wishlist items belong to one user and may have one purchase record
- Purchase records link purchaser to item

### External Dependencies

**Authentication Service:**
- **Replit Auth** (OIDC) - Handles user identity and session management
- Environment variables: `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`

**Database:**
- **Neon Serverless PostgreSQL** - Serverless Postgres with WebSocket support
- Environment variable: `DATABASE_URL`
- Connection pooling via `@neondatabase/serverless`

**Email Service:**
- **Resend** - Transactional email API for sending family invitations
- Environment variable: `RESEND_API_KEY`
- Email module: `server/emailService.ts`
- **Development Limitation**: In testing mode without a verified domain, Resend only allows sending emails to the account owner's verified email address. To send to any email address in production, verify a domain at resend.com/domains

**Product Search:**
- **SerpApi** - Google Shopping API for product search
- Environment variable: `SERPAPI_KEY`
- Search endpoint: `GET /api/search?q={query}`
- **Features:**
  - Location-aware search (United States, English language)
  - Returns up to 20 results per query
  - Smart popularity sorting: rating × log₁₀(reviews + 1) with position fallback
  - Client-side caching (5-minute staleTime) for improved performance
  - Handles various rating/review formats (strings, numbers, "1.2K" notation)

**Development Tools:**
- **Vite plugins**: Runtime error overlay, cartographer (Replit), dev banner (Replit)
- **Drizzle Kit** for database migrations and schema push
- **esbuild** for production server bundling

**UI Component Dependencies:**
- 20+ Radix UI primitives (accordion, alert-dialog, avatar, checkbox, dialog, dropdown-menu, etc.)
- **cmdk** for command palette functionality
- **date-fns** for date manipulation
- **lucide-react** for icon system

**Build & Runtime:**
- **tsx** for TypeScript execution in development
- **ws** WebSocket library for Neon database connections
- **connect-pg-simple** for PostgreSQL session store
- **memoizee** for caching OIDC configuration