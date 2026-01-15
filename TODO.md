# Ultralight Gear Tracker

A gear tracking application for ultralight backpacking, inspired by lighterpack.com but focused on better design and UX.

## Tech Stack
- TypeScript
- Next.js (App Router)
- Tailwind CSS
- Drizzle ORM with PostgreSQL
- next-themes for dark mode
- Vaul for sheets/drawers

## Tasks

### Project Setup
- [x] Initialize Next.js project with TypeScript and Tailwind
- [x] Set up Drizzle ORM with PostgreSQL connection
- [x] Configure next-themes for dark mode support
- [x] Install and configure Vaul library
- [x] Set up project folder structure (components, lib, db, etc.)

### Database Schema
- [x] Create users table (id, username, email, password_hash, created_at, updated_at)
- [x] Create anonymous_sessions table for anonymous user support
- [x] Create lists table (id, user_id, anonymous_session_id, name, slug, description, is_public, created_at, updated_at)
- [x] Create categories table (id, list_id, name, description, position, created_at, updated_at)
- [x] Create items table (id, category_id, name, description, url, weight_amount, weight_unit, label, quantity, position, created_at, updated_at)
- [x] Set up database migrations

### Authentication
- [x] Implement sign up (username, email, password) with validation
- [x] Implement sign in with session management
- [x] Implement sign out functionality
- [ ] Implement password reset flow (request reset, email token, reset form)
- [x] Implement anonymous user session creation and tracking
- [x] Link anonymous data to user account on sign up

### Lists Feature
- [x] Create list API endpoint (POST /api/lists)
- [x] Generate unique slug per user from list name
- [x] Edit list API endpoint (PATCH /api/lists/[id])
- [x] Delete list API endpoint (DELETE /api/lists/[id])
- [x] Get user's lists API endpoint (GET /api/lists)
- [x] Get single list with categories and items API endpoint (GET /api/lists/[id])

### Categories Feature
- [x] Create category API endpoint (POST /api/categories)
- [x] Edit category API endpoint (PATCH /api/categories/[id])
- [x] Delete category API endpoint (DELETE /api/categories/[id])
- [ ] Reorder categories API endpoint (PATCH /api/categories/reorder)

### Items Feature
- [x] Create item API endpoint (POST /api/items)
- [x] Edit item API endpoint (PATCH /api/items/[id])
- [x] Delete item API endpoint (DELETE /api/items/[id])
- [ ] Reorder items API endpoint (PATCH /api/items/reorder) - supports cross-category moves
- [x] Validate weight units (g, oz) and labels (none, worn, consumable)

### UI Components
- [x] Create responsive Dialog/Sheet component (Dialog on desktop, Vaul sheet on mobile)
- [x] Create list form component (name, description)
- [x] Create category form component (name, description)
- [x] Create item form component (name, description, url, weight, unit, label, quantity)
- [ ] Create list edit popover component
- [ ] Create sidebar component with Vaul for viewing lists (persists open state in cookie)
- [ ] Create drag-and-drop for category reordering
- [ ] Create drag-and-drop for item reordering (including cross-category)
- [ ] Create weight unit selector component (g, kg, lbs, oz)
- [ ] Create dark mode toggle component

### List Detail Page
- [x] Build list detail page layout
- [x] Create weight summary table component (grouped by category)
- [x] Implement weight calculations (base, worn, consumable)
- [x] Handle worn items with quantity > 1 (first worn, rest base weight)
- [x] Implement unit conversion for display (g, kg, lbs, oz)
- [ ] Make list detail page fully responsive

### Public List Page
- [ ] Create public list route at /[username]/[slug]
- [ ] Implement SSR with caching for public lists
- [ ] Invalidate cache when list contents change
- [ ] Handle 404 for non-existent or private lists

### Homepage & Routing
- [ ] Redirect authenticated users to most recently edited list
- [ ] Implement streaming SSR for list page
- [ ] Handle anonymous users landing on blank list detail page
- [ ] Ensure anonymous users can perform all actions except sharing

### Polish & Testing
- [ ] Ensure all UI is responsive and works on mobile
- [ ] Add loading states and error handling
- [ ] Write tests for authentication flows
- [ ] Write tests for list/category/item CRUD operations
- [ ] Write tests for weight calculations
- [ ] Test anonymous user to authenticated user data migration
