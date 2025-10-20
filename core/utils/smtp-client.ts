/**
 * SMTP Client Utilities
 *
 * Provides SMTP connection testing using nodemailer.
 * Used for verifying SMTP settings before saving to database.
 */

import nodemailer from 'nodemailer';
import type { SmtpSettings } from '../services/system-settings.schemas.js';

/**
 * Test SMTP connection by verifying credentials
 *
 * Used for connection testing in settings UI.
 *
 * @param settings - SMTP configuration
 * @returns true if connection successful
 * @throws Error if connection fails
 */
export async function testSmtpConnection(settings: SmtpSettings): Promise<boolean> {
  // Create transporter with provided settings and timeouts
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
    // Timeout settings to prevent hanging requests
    connectionTimeout: 10000, // 10s to establish connection
    greetingTimeout: 10000, // 10s to receive greeting after connection
    socketTimeout: 10000, // 10s of inactivity allowed
  });

  try {
    // Verify connection configuration
    // This sends a test command to the SMTP server
    await transporter.verify();
    return true;
  } catch (error) {
    throw new Error(
      `SMTP connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
