/**
 * S3 Client Utilities
 *
 * Provides S3 upload/delete operations using AWS SDK v3.
 * Supports both AWS S3 and S3-compatible services (MinIO, etc.)
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

/**
 * S3 settings structure
 */
export interface S3Settings {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // For S3-compatible services (MinIO, etc.)
}

/**
 * Create S3 client from settings
 *
 * @param settings - S3 configuration
 * @returns Configured S3 client
 */
function createS3Client(settings: S3Settings): S3Client {
  const config: {
    region: string;
    credentials: { accessKeyId: string; secretAccessKey: string };
    endpoint?: string;
    forcePathStyle?: boolean;
    requestHandler: NodeHttpHandler;
  } = {
    region: settings.region,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 10000, // 10s connection timeout
      requestTimeout: 10000, // 10s request timeout
    }),
  };

  // Add optional properties only if they have values
  if (settings.endpoint) {
    config.endpoint = settings.endpoint;
    config.forcePathStyle = true; // Required for MinIO
  }

  return new S3Client(config);
}

/**
 * Upload file to S3
 *
 * @param settings - S3 configuration
 * @param key - Object key (e.g., "tenants/default/logo.png")
 * @param buffer - File buffer
 * @param contentType - MIME type
 * @returns S3 object URL
 * @throws Error if upload fails
 */
export async function uploadToS3(
  settings: S3Settings,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = createS3Client(settings);

  const command = new PutObjectCommand({
    Bucket: settings.bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  } satisfies PutObjectCommandInput);

  try {
    await client.send(command);

    // Construct object URL
    // Format: https://<bucket>.s3.<region>.amazonaws.com/<key>
    // Or for custom endpoint: <endpoint>/<bucket>/<key>
    if (settings.endpoint) {
      // S3-compatible service (MinIO, etc.)
      const endpointUrl = settings.endpoint.replace(/\/$/, ''); // Remove trailing slash
      return `${endpointUrl}/${settings.bucket}/${key}`;
    } else {
      // AWS S3
      return `https://${settings.bucket}.s3.${settings.region}.amazonaws.com/${key}`;
    }
  } catch (error) {
    throw new Error(
      `Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Delete file from S3
 *
 * @param settings - S3 configuration
 * @param key - Object key (e.g., "tenants/default/logo.png")
 * @throws Error if deletion fails
 */
export async function deleteFromS3(settings: S3Settings, key: string): Promise<void> {
  const client = createS3Client(settings);

  const command = new DeleteObjectCommand({
    Bucket: settings.bucket,
    Key: key,
  });

  try {
    await client.send(command);
  } catch (error) {
    throw new Error(
      `Failed to delete from S3: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Test S3 connection by attempting to list bucket
 *
 * Used for connection testing in settings UI.
 *
 * @param settings - S3 configuration
 * @returns true if connection successful
 * @throws Error if connection fails
 */
export async function testS3Connection(settings: S3Settings): Promise<boolean> {
  const client = createS3Client(settings);

  // Try to put and delete a test object
  const testKey = `_test/${Date.now()}.txt`;
  const testBuffer = Buffer.from('test', 'utf-8');

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: settings.bucket,
        Key: testKey,
        Body: testBuffer,
      })
    );

    await client.send(
      new DeleteObjectCommand({
        Bucket: settings.bucket,
        Key: testKey,
      })
    );

    return true;
  } catch (error) {
    throw new Error(
      `S3 connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
