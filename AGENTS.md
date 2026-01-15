# Ultralight Gear Tracker - Development Notes

## Running the Project

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Database Commands

- `npm run db:generate` - Generate migrations from schema changes
- `npm run db:migrate` - Run pending migrations
- `npm run db:push` - Push schema directly to database (development)
- `npm run db:studio` - Open Drizzle Studio GUI

## Environment Variables

Copy `.env.example` to `.env.local` and configure:
- `DATABASE_URL` - PostgreSQL connection string

## Tech Stack

- Next.js 16 with App Router
- TypeScript
- Tailwind CSS v4
- React 19
- Drizzle ORM with PostgreSQL

## Project Structure

- `/src/app` - Next.js App Router pages and layouts
- `/src/db` - Database schema and connection
- `/src/lib` - Utility functions and shared code
- `/src/components` - React components
- `/drizzle` - Database migrations (generated)
- `/src` - Source code with @/* path alias
