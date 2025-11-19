# Design Guidelines: Family Christmas Wishlist Manager

## Design Approach

**Hybrid Approach: Experience + Utility**
- Primary inspiration: Pinterest's visual card grids + Notion's organized data display + Airbnb's warm group experiences
- Festive, family-oriented atmosphere balanced with efficient wishlist management
- Visual hierarchy emphasizing products while maintaining functional clarity

## Typography System

**Font Families:**
- Primary: Inter (body text, UI elements, data) - clean, readable
- Display: Playfair Display (headings, family names, welcome messages) - warmth and elegance

**Hierarchy:**
- H1 (Family Group Names): 2.5rem, Display font, semibold
- H2 (Section Headers): 1.875rem, Display font, medium
- H3 (Member Names, Product Titles): 1.25rem, Primary font, semibold
- Body: 1rem, Primary font, regular
- Small (Prices, Metadata): 0.875rem, Primary font, medium
- Micro (Labels, Timestamps): 0.75rem, Primary font, regular

## Layout System

**Spacing Primitives (Tailwind):**
Core units: 2, 4, 6, 8, 12, 16
- Component padding: p-4 (mobile), p-6 (tablet), p-8 (desktop)
- Section spacing: space-y-8 (standard), space-y-12 (major sections)
- Card gaps: gap-4 (mobile), gap-6 (desktop)
- Page margins: px-4 (mobile), px-8 (tablet), px-12 (desktop, max-width container)

**Grid Patterns:**
- Wishlist items: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
- Family members: grid-cols-2 md:grid-cols-3 lg:grid-cols-4
- Product search results: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3

## Component Library

### Navigation
**Top Bar:**
- Sticky header with app logo (festive wordmark), family group switcher, user avatar/menu
- Height: h-16, backdrop blur effect
- Mobile: Hamburger menu revealing drawer navigation

**Sidebar (Desktop):**
- Fixed left sidebar (w-64) with: Dashboard, My Wishlist, Family Members, Search Products, Settings
- Collapsible on tablet, hidden on mobile

### Cards & Product Display

**Wishlist Item Card:**
- Aspect ratio 4:3 product image with rounded corners (rounded-lg)
- Overlay gradient on image for better text readability
- Content section: Product title (line-clamp-2), price (large, prominent), description (line-clamp-3)
- Action bar: Quick view, Mark purchased (for others' lists), Edit (own list)
- Purchased state: Semi-transparent overlay with "Purchased by [Name]" badge, hidden from list owner

**Product Search Result Card:**
- Compact layout with square product image (1:1 ratio)
- Inline details: title, price, source retailer
- Single CTA: "Add to My List" button prominently displayed
- Hover state: Subtle lift shadow effect

**Family Member Card:**
- Circular avatar (h-20 w-20) with member name
- List status indicator: "X items on list"
- CTA: "View [Name]'s List" button

### Forms & Inputs

**Manual Item Add Form:**
- Large dropzone area for image upload with dashed border
- Stacked fields: Item name (text), Description (textarea, h-24), Price (number with currency prefix), URL (text with link icon)
- Field spacing: space-y-4
- Submit button: Full-width on mobile, auto-width on desktop

**Product Search:**
- Hero search bar: Large (h-14), rounded-full, with search icon and loading spinner state
- Filter chips below: Price range, category (scrollable horizontal list)

### Data Display

**Empty States:**
- Centered content with large icon (h-24 w-24), heading, description, and primary CTA
- Examples: "No items yet", "No family members", "No search results"

**List View Variants:**
- Grid view (default): Product cards in responsive grid
- Compact list: Horizontal layout with thumbnail, title, price, actions (alternative view option)

### Modals & Overlays

**Item Detail Modal:**
- Full-screen on mobile, centered overlay (max-w-4xl) on desktop
- Two-column layout: Product image gallery (60%), details sidebar (40%)
- Includes: Full description, price history, notes section (for others viewing), purchase marker

**Invitation Modal:**
- Centered card (max-w-md) with family code display, copy button
- Share links for email/SMS with pre-filled messages

**Notes Drawer:**
- Slide-in from right (w-96)
- Sticky header with item thumbnail and name
- Scrollable notes list with timestamps
- Add note form at bottom

### Badges & Indicators

**Status Badges:**
- "Purchased" badge: Rounded-full, px-3 py-1, with checkmark icon
- "New" badge: Small pill on recently added items
- Price tags: Distinct styling with larger font weight

**Notification Dots:**
- Red dot (h-2 w-2) on family member cards when new items added
- Positioned top-right of avatar

## Visual Patterns

**Festive Elements (Subtle):**
- Snowflake decorations as background pattern (very subtle, low opacity)
- Rounded corners throughout (rounded-lg standard, rounded-xl for major cards)
- Soft shadows for depth (shadow-sm for cards, shadow-md for elevated elements)

**Seasonal Touches:**
- Gift box icon for empty wishlists
- Ribbon accent on "purchased" items
- Festive iconography in navigation (gifts, stars, family)

## Responsive Behavior

**Breakpoints:**
- Mobile (< 640px): Single column, full-width cards, bottom tab navigation
- Tablet (640px - 1024px): 2-column grids, sidebar collapses to icons only
- Desktop (> 1024px): Full multi-column grids, expanded sidebar, modal overlays

**Touch Targets:**
- Minimum 44x44px for all interactive elements
- Increased spacing between action buttons on mobile (gap-4 minimum)

## Interactions (Minimal Animation)

**Micro-interactions:**
- Button press: Subtle scale (scale-95 on active)
- Card hover: Gentle lift (translate-y-1) with shadow increase
- Loading states: Skeleton screens for data fetching, spinner for search
- Page transitions: Simple fade (no elaborate animations)

**Feedback:**
- Toast notifications for actions: "Item added", "Marked as purchased"
- Success states: Green checkmark icon with brief message
- Error states: Red alert banner with retry option

## Images

**Hero Section (Dashboard):**
- Warm, festive header image showing wrapped gifts, family gathering, or Christmas tree
- Height: h-64 on desktop, h-48 on mobile
- Overlay gradient for text readability
- Welcome message overlaid: "Welcome back, [Name]!" with family group name below

**Product Images:**
- Required for all wishlist items
- Fallback placeholder: Gift box icon on textured background for items without images
- Lazy loading for performance
- Aspect ratio maintained: 4:3 for cards, 1:1 for thumbnails

**Avatar Images:**
- Circular profile photos for family members
- Default avatar: Initial letter on gradient background if no photo uploaded

This design creates a warm, festive experience that makes family gift coordination delightful while maintaining clarity for efficient wishlist management.