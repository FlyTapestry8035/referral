import { config } from "dotenv";

// Integration tests use the same .env.local as `npm run dev` (pointing at `supabase start`).
config({ path: ".env.local", quiet: true });
config({ path: ".env.test", override: true, quiet: true });
