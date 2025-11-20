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

**User Profile Features:**
- User settings dialog accessible via sidebar avatar
- Profile updates: firstName, lastName, profileImageUrl
- Image upload supports base64 data URIs and HTTP/HTTPS URLs
- Form validation: non-empty names required, image format validated
- Empty submissions handled as no-op (returns current user)

**Product Search & Add Flow:**
- Product details edit dialog shown before adding from search
- Edit capabilities: name, price, description, URL, image, priority, quantity, category
- Price validation: allows $0 or greater, handles NaN/empty as null
- Category optional (omitted if null)
- Form pre-populated with search result data
- "Add Manually" button available on search page for quick manual entry

**Shopping Options Dialog:**
- Simplified interface with "View product with Google Shopping" button
- Opens Google Shopping search in new tab with item name as query
- Optional original product link if available
- No longer shows individual retailer listings (removed "Where to Buy" section)
- No longer fetches from `/api/wishlist/:id/shopping-options` endpoint (removed)
- Only accessible when viewing other family members' wishlists (not your own)

**Wishlist Image Upload:**
- Image upload via ObjectUploader component using Uppy v5 dashboard modal
- Replaces previous imageUrl text input field
- Upload button displays "Upload Image" with Upload icon
- Shows "Image uploaded" message and preview thumbnail after successful upload
- Edit dialog displays existing image thumbnail if item has imageUrl
- Maximum file size: 10MB per image
- Images stored in Replit Object Storage with public ACL for family access
- **Implementation Details:**
  - Uppy cleanup uses `destroy()` method for proper v5 compatibility
  - FormField uses `{...field}` pattern for proper form state synchronization
  - State management clears uploaded image URL on successful mutation
  - URL normalization handles both PRIVATE_OBJECT_DIR formats (with/without bucket)

**Wishlist Organization:**
- Priority-based filtering and sorting system
- Filter badges: "All Priorities", "Must-Have!" (high), "Would Love" (medium), "Just a Thought" (low)
- Automatic sorting: high priority → medium → low
- Visual priority indicators with icons (ArrowUp, Circle, AlertCircle)
- Category field still available for data entry but not used for filtering

**Dashboard Invite Feature:**
- "Invite Family Member" quick action card opens invitation dialog directly
- Dialog provides two invitation methods: email and manual sharing
- Email invitation section with form validation and API integration
- Manual sharing section with invite code and link copy buttons
- Copy buttons show check icon feedback and toast notifications
- Dialog matches members page invite functionality for consistency
- Available on dashboard when user has selected a family

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
- Comprehensive Zod validation on all endpoints:
  - Whitelisted fields only (prevents arbitrary updates)
  - Non-empty string validation with trim()
  - Profile images: accepts base64 data URIs (`data:image/*`) or valid URLs
  - Numeric validation: rejects NaN, allows 0 for prices
  - Empty payloads handled as no-ops where appropriate

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
  - Intelligent retailer prioritization:
    - Tier 0 (highest): Brand's own website (e.g., apple.com for "apple iphone")
    - Tier 1: Reputable US retailers (Amazon, Best Buy, Target, Walmart, Apple Store, Samsung, and 30+ others)
    - Tier 2: Other retailers
  - Excludes unreliable retailers (Temu, Wish, AliExpress, DHgate, Banggood, Gearbest)
  - Recursive URL extraction:
    - Decodes Google redirect URLs to find actual merchant domains
    - Handles nested redirects with depth limiting (max 5 levels)
    - Extracts merchant URLs from `url`, `u`, and `q` query parameters
    - Ensures accurate brand and retailer tier detection even with encoded URLs
  - Within same tier: sorted by popularity score (rating × log₁₀(reviews + 1))
  - Client-side caching (5-minute staleTime) for improved performance
  - Handles various rating/review formats (strings, numbers, "1.2K" notation)

**Object Storage:**
- **Replit Object Storage** - Cloud storage for wishlist item images
- Environment variables: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`
- **Features:**
  - Direct browser uploads via presigned URLs (no server bandwidth usage)
  - Public visibility for wishlist images (accessible by all family members)
  - ACL-based access control with read/write permissions
  - Automatic bucket management and file serving
- **API Endpoints:**
  - `POST /api/objects/upload` - Get presigned URL for file upload
  - `PUT /api/wishlist-images` - Set ACL policy for uploaded wishlist image
  - `GET /objects/:objectPath` - Serve images with authentication and ACL checks
- **Frontend Integration:**
  - Uppy v5 file uploader with dashboard modal interface
  - Maximum file size: 10MB per image
  - Upload button in Add/Edit item dialogs
  - Image preview after successful upload
  - Import path: `import DashboardModal from "@uppy/react/dashboard-modal"`
  - CSS: `@uppy/core/css/style.css` and `@uppy/dashboard/css/style.css`

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