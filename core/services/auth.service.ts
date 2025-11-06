/**
 * Authentication Service
 *
 * Provides business logic for user authentication.
 * Handles login, password verification, and user retrieval.
 *
 * Architecture:
 * - Remix action -> Auth Service -> Drizzle ORM -> PostgreSQL
 * - Password hashing: bcrypt
 * - Session management: Remix Sessions (app/sessions.server.ts)
 *
 * Security considerations:
 * - Passwords are hashed with bcrypt (salt rounds: 10)
 * - Password verification uses constant-time comparison (bcrypt.compare)
 * - Never returns password hashes to callers
 * - Login function returns null for both "user not found" and "invalid password"
 *   to prevent timing attacks that reveal user existence
 */

import { getDb } from '../db/connection.js';
import * as schema from '../db/schema/index.js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Dummy bcrypt hash for constant-time comparison
 *
 * This is a valid bcrypt hash used when the user doesn't exist.
 * It ensures login timing is consistent whether user exists or not,
 * preventing timing attacks that could reveal user existence.
 *
 * Generated via: bcrypt.hash('dummy-password', 10)
 */
const DUMMY_PASSWORD_HASH =
  '$2a$10$CwTycUXWue0Thq9StjUM0uJ8ZXoE5s3UeawuO/7dBDEzDfSU/EYEW';

/**
 * Zod schema for login credentials
 *
 * Validates email format and password minimum length.
 * Used for runtime validation of login inputs.
 */
export const LoginSchema = z.object({
  email: z
    .string()
    .email(),
  password: z
    .string()
    .min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * User type (simplified for authentication)
 *
 * This is a subset of the full users table schema,
 * containing only the fields needed for authentication and authorization.
 * Password hash is intentionally excluded for security.
 */
export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: 'admin' | 'member';
  /**
   * User permissions (optional, for RBAC)
   * Example: ['plugin:logs:read', 'campaign:create']
   */
  permissions?: string[];
}

/**
 * Verify user credentials and return user info
 *
 * This function performs the following steps:
 * 1. Validates input format using Zod schema
 * 2. Queries the users table by email (case-insensitive)
 * 3. Verifies the password using bcrypt.compare()
 * 4. Returns user info if valid, null if invalid
 *
 * Security considerations:
 * - Uses bcrypt.compare() for constant-time password comparison
 * - Never returns password hash to caller
 * - Returns null for both "user not found" and "invalid password"
 *   to prevent timing attacks that could reveal user existence
 * - Checks that user account is not disabled
 *
 * @param email - User email address
 * @param password - Plain text password
 * @returns User object if credentials are valid, null otherwise
 * @throws {Error} If database error occurs or input validation fails
 *
 * Usage:
 * ```typescript
 * const user = await login('user@example.com', 'password123');
 * if (user) {
 *   // Create session with user.userId and user.tenantId
 * } else {
 *   // Show error: "Invalid email or password"
 * }
 * ```
 */
export async function login(
  email: string,
  password: string
): Promise<AuthUser | null> {
  // 1. Validate input format
  const validated = LoginSchema.parse({ email, password });

  // 2. Query user by email
  // Note: Email should be CITEXT in PostgreSQL for case-insensitive matching
  // For now, we convert to lowercase for case-insensitive comparison
  const db = getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, validated['email'].toLowerCase()))
    .limit(1);

  // 3. Verify password and account status
  // Important: Use single condition to prevent timing attacks
  // This ensures both "user not found" and "invalid password" take the same time
  if (!user || !user.passwordHash || user.disabled) {
    // Run bcrypt.compare even when user doesn't exist to maintain constant time
    if (!user || !user.passwordHash) {
      // Compare against dummy hash to maintain consistent timing
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    }
    return null; // User not found, no password set, or account disabled
  }

  // Verify password using bcrypt
  const isValid = await bcrypt.compare(validated['password'], user.passwordHash);
  if (!isValid) {
    return null; // Invalid password
  }

  // 4. Return user info (without password hash)
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName || user.email,
    tenantId: user.tenantId,
    role: (user.role as 'admin' | 'member') || 'member',
  };
}

/**
 * Get user by ID
 *
 * Retrieves user information by user ID.
 * Used in authentication middleware to validate sessions.
 *
 * @param userId - User ID (UUID)
 * @returns User object or null if not found
 * @throws {Error} If database error occurs
 *
 * Usage:
 * ```typescript
 * const session = await getSession(request);
 * const userId = session.get('userId');
 * const user = await getUserById(userId);
 * if (!user) {
 *   // Session is invalid, redirect to login
 * }
 * ```
 */
export async function getUserById(userId: string): Promise<AuthUser | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(
      and(
        eq(schema.users.userId, userId),
        eq(schema.users.disabled, false)
      )
    )
    .limit(1);

  if (!user) {
    return null;
  }

  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName || user.email,
    tenantId: user.tenantId,
    role: (user.role as 'admin' | 'member') || 'member',
  };
}

/**
 * Hash password using bcrypt
 *
 * Hashes a plain text password with bcrypt.
 * Uses 10 salt rounds (recommended minimum for security).
 *
 * @param password - Plain text password
 * @returns Hashed password (bcrypt format)
 *
 * Usage: When creating or updating users
 * ```typescript
 * const passwordHash = await hashPassword('user-password');
 * await db.insert(schema.users).values({
 *   email: 'user@example.com',
 *   passwordHash,
 *   // ...other fields
 * });
 * ```
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10; // Recommended minimum for security
  return bcrypt.hash(password, saltRounds);
}

/**
 * Dashboard User type (for route loaders)
 *
 * Extended user information for dashboard routes,
 * including capabilities for permission filtering.
 */
export interface DashboardUser {
  userId: string;
  email: string;
  displayName: string;
  role: 'admin' | 'member';
  tenantId: string;
  avatarUrl?: string;
  capabilities?: string[];
}

/**
 * Convert AuthUser to Dashboard User
 *
 * Maps authentication user data to dashboard user format,
 * properly handling capabilities/permissions for RBAC.
 *
 * Business logic:
 * - Admin users get wildcard capability ['*'] for full access
 * - Non-admin users get their permissions mapped to capabilities
 * - displayName defaults to email if not set
 * - Handles null/undefined permissions safely
 *
 * @param authUser - Authenticated user from requireAuth()
 * @returns Dashboard user object with capabilities
 *
 * Usage in route loaders:
 * ```typescript
 * export async function loader({ request }: LoaderFunctionArgs) {
 *   const authUser = await requireAuth(request);
 *   const user = convertAuthUserToDashboardUser(authUser);
 *   // user.capabilities is now properly set for filtering
 *   return json({ user });
 * }
 * ```
 */
export function convertAuthUserToDashboardUser(
  authUser: AuthUser
): DashboardUser {
  // Admin users get wildcard capability for full access
  // Non-admin users get their permissions mapped to capabilities
  const capabilities: string[] =
    authUser.role === 'admin'
      ? ['*']
      : Array.isArray(authUser.permissions)
        ? authUser.permissions.filter((p): p is string => typeof p === 'string')
        : [];

  return {
    userId: authUser.userId,
    email: authUser.email,
    displayName: authUser.displayName || authUser.email,
    role: authUser.role,
    tenantId: authUser.tenantId,
    capabilities,
  };
}

/**
 * Plugin Authentication Context
 *
 * Returned by verifyPluginToken() when plugin token is valid.
 * Contains plugin identity and tenant context.
 */
export interface PluginAuthContext {
  pluginId: string;
  tenantId: string;
  nonce: string;
}

/**
 * Generate Plugin Token
 *
 * Generates a short-lived HMAC-signed token for plugin-to-core API authentication.
 * Token format: base64(payload).signature
 * Payload format: pluginId:tenantId:timestamp:nonce
 *
 * Security features:
 * - HMAC-SHA256 signature prevents tampering
 * - Cryptographically secure nonce (UUID v4) prevents replay attacks
 * - Timestamp limits validity to 5 minutes + ±30 seconds clock skew
 * - Nonce is stored in Redis/DB for replay detection
 *
 * @param pluginId - Plugin identifier
 * @param tenantId - Tenant identifier
 * @param secret - HMAC secret (from PLUGIN_INTERNAL_SECRET env variable)
 * @returns Signed token string
 *
 * Usage:
 * ```typescript
 * const token = generatePluginToken('github', 'default', secret);
 * // Pass token in Authorization header: Bearer ${token}
 * ```
 */
export function generatePluginToken(
  pluginId: string,
  tenantId: string,
  secret: string
): string {
  const crypto = require('crypto');

  // Generate cryptographically secure nonce (UUID v4)
  const nonce = crypto.randomUUID();

  // Get current timestamp in seconds
  const timestamp = Math.floor(Date.now() / 1000);

  // Construct payload: pluginId:tenantId:timestamp:nonce
  const payload = `${pluginId}:${tenantId}:${timestamp}:${nonce}`;

  // Generate HMAC-SHA256 signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');

  // Encode payload as base64
  const payloadBase64 = Buffer.from(payload).toString('base64');

  // Return token: base64(payload).signature
  return `${payloadBase64}.${signature}`;
}

/**
 * Verify Plugin Token
 *
 * Verifies HMAC signature and checks nonce/timestamp validity.
 * Implements anti-replay protection by storing used nonces.
 *
 * Validation steps:
 * 1. Parse token format (payload.signature)
 * 2. Verify HMAC signature
 * 3. Check timestamp within validity window (5 min + ±30s clock skew)
 * 4. Check nonce not previously used (Redis primary, DB fallback)
 * 5. Store nonce to prevent replay
 *
 * @param token - Token string from Authorization header
 * @param secret - HMAC secret (from PLUGIN_INTERNAL_SECRET env variable)
 * @returns Plugin auth context if valid
 * @throws {Error} If token is invalid, expired, or replayed
 *
 * Usage:
 * ```typescript
 * try {
 *   const context = await verifyPluginToken(token, secret);
 *   // context.pluginId, context.tenantId are now available
 * } catch (error) {
 *   // Token invalid, return 401 Unauthorized
 * }
 * ```
 */
export async function verifyPluginToken(
  token: string,
  secret: string
): Promise<PluginAuthContext> {
  const crypto = require('crypto');

  // 1. Parse token format
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }

  const payloadBase64 = parts[0];
  const providedSignature = parts[1];

  if (!payloadBase64 || !providedSignature) {
    throw new Error('Invalid token format');
  }

  // Decode payload
  let payload: string;
  try {
    payload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
  } catch {
    throw new Error('Invalid token encoding');
  }

  // 2. Verify HMAC signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = hmac.digest('hex');

  if (providedSignature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }

  // Parse payload: pluginId:tenantId:timestamp:nonce
  const payloadParts = payload.split(':');
  if (payloadParts.length !== 4) {
    throw new Error('Invalid payload format');
  }

  const pluginId = payloadParts[0];
  const tenantId = payloadParts[1];
  const timestampStr = payloadParts[2];
  const nonce = payloadParts[3];

  if (!pluginId || !tenantId || !timestampStr || !nonce) {
    throw new Error('Invalid payload format');
  }

  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    throw new Error('Invalid timestamp');
  }

  // 3. Check timestamp validity
  // Validity window: 5 minutes + ±30 seconds clock skew
  const now = Math.floor(Date.now() / 1000);
  const validityWindow = 5 * 60; // 5 minutes
  const clockSkew = 30; // 30 seconds

  const minValidTime = timestamp - clockSkew;
  const maxValidTime = timestamp + validityWindow + clockSkew;

  if (now < minValidTime || now > maxValidTime) {
    throw new Error('Token expired or future-dated');
  }

  // 4. Check nonce not previously used (anti-replay)
  const db = getDb();
  const existingNonce = await db
    .select()
    .from(schema.pluginNonces)
    .where(
      and(
        eq(schema.pluginNonces.tenantId, tenantId),
        eq(schema.pluginNonces.pluginId, pluginId),
        eq(schema.pluginNonces.nonce, nonce)
      )
    )
    .limit(1);

  if (existingNonce.length > 0) {
    throw new Error('Token replay detected');
  }

  // 5. Store nonce to prevent future replay
  await db.insert(schema.pluginNonces).values({
    tenantId,
    pluginId,
    nonce,
  });

  // Return plugin auth context
  return {
    pluginId,
    tenantId,
    nonce,
  };
}

/**
 * Cleanup Expired Nonces
 *
 * Garbage collection job that removes expired nonces from the database.
 * Should be run periodically (e.g., every 10 minutes via cron).
 *
 * Cleanup criteria:
 * - Remove nonces older than validity window + clock skew
 * - Window: 5 minutes + 30 seconds + 30 seconds = 6 minutes
 *
 * @returns Number of nonces deleted
 *
 * Usage:
 * ```typescript
 * // In cron job or scheduled task
 * const deleted = await cleanupExpiredNonces();
 * console.log(`Cleaned up ${deleted} expired nonces`);
 * ```
 */
export async function cleanupExpiredNonces(): Promise<number> {
  const db = getDb();

  // Calculate cutoff time (6 minutes ago)
  const validityWindow = 5 * 60; // 5 minutes
  const clockSkew = 30; // 30 seconds
  const bufferTime = 30; // 30 seconds extra buffer
  const cutoffSeconds = validityWindow + clockSkew + bufferTime;

  const cutoffTime = new Date(Date.now() - cutoffSeconds * 1000);

  // Delete old nonces
  const result = await db
    .delete(schema.pluginNonces)
    .where(sql`${schema.pluginNonces.createdAt} < ${cutoffTime}`)
    .returning({ nonceId: schema.pluginNonces.nonceId });

  return result.length;
}

