import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as relations from './relations'
import * as schema from './schema'

// For server-side usage only
// Use restricted user for application if available, otherwise fall back to regular user
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

if (
  !process.env.DATABASE_URL &&
  !process.env.DATABASE_RESTRICTED_URL &&
  !process.env.POSTGRES_URL &&
  !isTest
) {
  throw new Error(
    'DATABASE_URL, DATABASE_RESTRICTED_URL, or POSTGRES_URL environment variable is not set'
  )
}

// Connection with connection pooling for server environments
// Prefer restricted user for application runtime, fall back to POSTGRES_URL (Supabase/Vercel)
const connectionString =
  process.env.DATABASE_RESTRICTED_URL ?? // Prefer restricted user
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  (isTest ? 'postgres://user:pass@localhost:5432/testdb' : undefined)

if (!connectionString) {
  throw new Error(
    'DATABASE_URL, DATABASE_RESTRICTED_URL, or POSTGRES_URL environment variable is not set'
  )
}

// Log which connection is being used (for debugging)
if (isDevelopment) {
  console.log(
    '[DB] Using connection:',
    process.env.DATABASE_RESTRICTED_URL
      ? 'Restricted User (RLS Active)'
      : 'Owner User (RLS Bypassed)'
  )
}

// SSL configuration: Use environment variable to control SSL
// DATABASE_SSL_DISABLED=true disables SSL completely (for local/Docker PostgreSQL)
// Default is to enable SSL (rejectUnauthorized: false for compatibility with Supabase pooler)
const sslConfig =
  process.env.DATABASE_SSL_DISABLED === 'true'
    ? false // Disable SSL entirely for local PostgreSQL
    : 'require' // Enable SSL for cloud DBs (Supabase, Neon, etc.)

const client = postgres(connectionString, {
  ssl: sslConfig,
  prepare: false,
  max: 20 // Max 20 connections
})

export const db = drizzle(client, {
  schema: { ...schema, ...relations }
})

// Helper type for all tables
export type Schema = typeof schema

// Verify restricted user permissions on startup
if (process.env.DATABASE_RESTRICTED_URL && !isTest) {
  // Only run verification in server environments, not during build
  if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
    ;(async () => {
      try {
        const result = await db.execute<{ current_user: string }>(
          sql`SELECT current_user`
        )
        const currentUser = result[0]?.current_user

        if (isDevelopment) {
          console.log('[DB] ✓ Connection verified as user:', currentUser)
        }

        // Verify it's the restricted user (app_user)
        if (
          currentUser &&
          !currentUser.includes('app_user') &&
          !currentUser.includes('neondb_owner')
        ) {
          console.warn(
            '[DB] ⚠️ Warning: Expected app_user but connected as:',
            currentUser
          )
        }
      } catch (error) {
        console.error('[DB] ✗ Failed to verify database connection:', error)
        // Log the error but don't terminate the application
        // This allows development to continue even with connection issues
      }
    })()
  }
}
