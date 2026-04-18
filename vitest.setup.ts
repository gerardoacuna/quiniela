import '@testing-library/jest-dom/vitest';
import { config as loadEnv } from 'dotenv';

// Load .env.local so integration tests can reach local Supabase.
loadEnv({ path: '.env.local' });
