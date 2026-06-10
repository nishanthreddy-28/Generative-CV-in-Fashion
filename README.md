# FashionAI — Generative CV in Fashion

> AI-powered virtual try-on and outfit generation system built with Next.js 16, Supabase, and OpenAI.

## Features

- 👗 **Wardrobe Management** — Upload and manage your clothing items
- 🤖 **AI Outfit Generation** — LLM-powered outfit suggestions
- 🪞 **Virtual Try-On** — See clothes on you before buying
- 📊 **Analytics** — Track your style preferences

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| AI | OpenAI API + pretrained CV models |
| State | Zustand |

## Project Structure

```
src/
├── app/            # Next.js routing (pages & API routes ONLY)
├── features/       # Domain modules (auth, wardrobe, outfit, try-on, user)
│   └── [domain]/
│       ├── actions/      # Server Actions
│       ├── components/   # Domain UI components
│       ├── hooks/        # Domain-specific hooks
│       ├── schemas/      # Zod validation schemas
│       ├── services/     # Client-side API callers
│       └── types.ts      # Domain types
├── server/         # Server-only utilities (db, auth, storage)
├── shared/         # Cross-feature reusable components & utils
├── lib/            # Third-party integrations (supabase, ai, validations)
├── store/          # Global client state (Zustand)
├── types/          # Shared TypeScript types
└── config/         # Environment & app configuration
middleware.ts       # Next.js route protection (Edge)
```

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/generative-cv-in-fashion.git
cd generative-cv-in-fashion
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in your Supabase and OpenAI credentials
```

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture Decisions

- **Feature-first structure**: Each domain (`wardrobe`, `outfit`, `try-on`) is self-contained with its own components, hooks, actions, and types.
- **Server/Client boundary**: All Supabase server calls and sensitive logic live in `src/server/`. Browser-safe code lives in `src/lib/supabase/client.ts`.
- **Server Actions over API routes**: Mutations use Next.js Server Actions (`features/*/actions/`) for type-safe, co-located server logic.
- **Repository pattern**: `src/server/db/*.repository.ts` wraps all database queries behind a clean interface.

## License

MIT
