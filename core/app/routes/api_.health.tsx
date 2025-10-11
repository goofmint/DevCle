import type { TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Health check endpoint for Docker healthcheck and monitoring
 * Returns 200 OK with a simple status message
 */
export async function loader(): Promise<TypedResponse<{ status: string }>> {
  return json({ status: "ok" }, { status: 200 });
}
