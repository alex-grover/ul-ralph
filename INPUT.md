I want to build a gear tracker for ultralight backpacking, similar to lighterpack.com but with fewer features and focused on better design and UX.

The core features I’m looking for are the following:
* App written in TypeScript, Next.js, Tailwind, Drizzle w/ Postgres
* Supports dark mode with next-themes
* Auth
    * Sign up (username, email, password)
    * Sign in
    * Sign out
    * Reset password
    * Anonymous user support
* Create list (name, description)
    * Name generates a slug that’s unique per user
* Edit list
    * This is available via a popover on the list detail page
    * Includes update list privacy (default private, can set to public)
* Create category (name, description)
* Edit category
* Drag to reorder category in list
* Create item (name, description, url, weight amount, weight unit (g or oz), label (none, worn, or consumable), quantity)
* Edit item
* Drag to reorder item in category (also allows dragging into a different category)
* View your lists
    * Visible in a sidebar using Vaul library that persists open state in a cookie
* View a single list
    * Includes a summary of the list weight at the top in a table grouped by category. Shows all category weights, base, worn, and consumable. For worn items with quantity > 1, only the first instance counts as worn weight, and the rest of the quantity counts as base weight. 
    * There is a selector to choose what units to show in the summary (also impacts the unit shown below in each category). G, Kg, lbs, oz
* Ensure that all UI is responsive and works well on mobile
    * Create list, category, and item forms should display in a dialog on desktop and a sheet using Vaul on mobile. 
* View publicly shared list at /username/slug
    * This page should be SSR’ed and cached so it’s only regenerated when the user makes changes to the contents of the list
* When you land on the homepage, you should be placed on the list page of your most recently edited list
    * This page should be fully streaming SSR’ed 
    * If you’re not signed in, you get placed on a blank list detail page. You can still perform all actions besides sharing a list. When you create an account, your anonymous data is linked.
