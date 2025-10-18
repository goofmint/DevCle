/**
 * S3 Settings Section Component
 *
 * Renders form fields for S3 storage configuration:
 * - S3 bucket name (text input)
 * - S3 region (text input)
 * - S3 access key ID (password input, masked)
 * - S3 secret access key (password input, masked)
 * - S3 endpoint (text input, optional for custom S3-compatible services)
 *
 * Features:
 * - Dark/light mode support
 * - Access key and secret key masking for security
 * - Endpoint field for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
 */

import { Icon } from '@iconify/react';

export interface S3SettingsSectionProps {
  s3Bucket: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Endpoint: string;
}

export function S3SettingsSection({
  s3Bucket,
  s3Region,
  s3AccessKeyId,
  s3SecretAccessKey,
  s3Endpoint,
}: S3SettingsSectionProps) {
  return (
    <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon icon="mdi:database" className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          S3 Storage Settings
        </h2>
      </div>

      <div className="space-y-4">
        {/* S3 Bucket */}
        <div>
          <label
            htmlFor="s3Bucket"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            S3 Bucket Name
          </label>
          <input
            type="text"
            id="s3Bucket"
            name="s3Bucket"
            defaultValue={s3Bucket}
            placeholder="my-bucket-name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
        </div>

        {/* S3 Region */}
        <div>
          <label
            htmlFor="s3Region"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            S3 Region
          </label>
          <input
            type="text"
            id="s3Region"
            name="s3Region"
            defaultValue={s3Region}
            placeholder="us-east-1, ap-northeast-1, etc."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            AWS region identifier (e.g., us-east-1)
          </p>
        </div>

        {/* S3 Access Key ID */}
        <div>
          <label
            htmlFor="s3AccessKeyId"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            S3 Access Key ID
          </label>
          <input
            type="password"
            id="s3AccessKeyId"
            name="s3AccessKeyId"
            defaultValue={s3AccessKeyId}
            placeholder="AKIA••••••••••••••••"
            autoComplete="off"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Access key is encrypted before storage
          </p>
        </div>

        {/* S3 Secret Access Key */}
        <div>
          <label
            htmlFor="s3SecretAccessKey"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            S3 Secret Access Key
          </label>
          <input
            type="password"
            id="s3SecretAccessKey"
            name="s3SecretAccessKey"
            defaultValue={s3SecretAccessKey}
            placeholder="••••••••••••••••••••••••••••••••••••••••"
            autoComplete="off"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Secret key is encrypted before storage
          </p>
        </div>

        {/* S3 Endpoint (Optional) */}
        <div>
          <label
            htmlFor="s3Endpoint"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            S3 Endpoint (Optional)
          </label>
          <input
            type="text"
            id="s3Endpoint"
            name="s3Endpoint"
            defaultValue={s3Endpoint}
            placeholder="https://s3.example.com"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Custom endpoint for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
          </p>
        </div>
      </div>
    </section>
  );
}
