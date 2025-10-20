/**
 * S3 Settings Form Component
 *
 * Provides UI for editing S3 integration settings:
 * - Bucket name
 * - Region
 * - Access Key ID
 * - Secret Access Key (masked)
 * - Endpoint (optional, for S3-compatible services like MinIO)
 * - Connection test button
 *
 * Features:
 * - Dark/Light mode support
 * - Password-type input for secret key (masked)
 * - Status indicator (configured/not configured)
 * - Test connection functionality
 * - Iconify icons (no inline SVG)
 * - Responsive design
 *
 * Props:
 * - s3Configured: Boolean flag indicating if S3 is already configured
 * - onSubmit: Form submission handler
 * - onTestConnection: Test connection handler
 * - isSubmitting: Loading state for form submission
 * - isTesting: Loading state for connection test
 */

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { useDarkMode } from '~/contexts/dark-mode-context';

/**
 * Props interface for S3SettingsForm
 */
export interface S3SettingsFormProps {
  s3Configured: boolean;
  onSubmit: (formData: FormData) => void;
  onTestConnection: (formData: FormData) => void;
  isSubmitting: boolean;
  isTesting: boolean;
}

/**
 * S3SettingsForm Component
 *
 * Renders a form for editing S3 integration settings.
 * Uses controlled components for all inputs.
 * Supports both light and dark modes with Tailwind CSS.
 *
 * Security:
 * - Secret Access Key is masked with password input type
 * - Only sends data on explicit form submission
 * - Never logs sensitive credentials
 */
export function S3SettingsForm({
  s3Configured,
  onSubmit,
  onTestConnection,
  isSubmitting,
  isTesting,
}: S3SettingsFormProps): JSX.Element {
  // Dark mode context for icon color adjustments
  const { isDark } = useDarkMode();

  // Local state for form fields
  // Note: We don't pre-populate secret fields from server for security
  const [bucket, setBucket] = useState('');
  const [region, setRegion] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [endpoint, setEndpoint] = useState('');

  /**
   * Handle form submission
   * Creates FormData and passes to parent onSubmit handler
   */
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append('section', 's3');
    formData.append('bucket', bucket);
    formData.append('region', region);
    formData.append('accessKeyId', accessKeyId);
    formData.append('secretAccessKey', secretAccessKey);
    formData.append('endpoint', endpoint);

    onSubmit(formData);
  };

  /**
   * Handle test connection button click
   * Creates FormData with current form values and passes to parent handler
   */
  const handleTestConnection = () => {
    const formData = new FormData();
    formData.append('bucket', bucket);
    formData.append('region', region);
    formData.append('accessKeyId', accessKeyId);
    formData.append('secretAccessKey', secretAccessKey);
    formData.append('endpoint', endpoint);

    onTestConnection(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon
            icon="mdi:cloud-upload"
            className={`w-6 h-6 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
          />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            S3 Settings
          </h2>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          {s3Configured ? (
            <>
              <Icon icon="mdi:check-circle" className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                Configured
              </span>
            </>
          ) : (
            <>
              <Icon icon="mdi:alert-circle" className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                Not Configured
              </span>
            </>
          )}
        </div>
      </div>

      {/* Bucket Field */}
      <div>
        <label
          htmlFor="s3Bucket"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Bucket Name
        </label>
        <input
          type="text"
          id="s3Bucket"
          name="bucket"
          value={bucket}
          onChange={(e) => setBucket(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="my-bucket"
          disabled={isSubmitting || isTesting}
          data-testid="s3-bucket-input"
        />
      </div>

      {/* Region Field */}
      <div>
        <label
          htmlFor="s3Region"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Region
        </label>
        <input
          type="text"
          id="s3Region"
          name="region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="us-east-1"
          disabled={isSubmitting || isTesting}
          data-testid="s3-region-input"
        />
      </div>

      {/* Access Key ID Field */}
      <div>
        <label
          htmlFor="s3AccessKeyId"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Access Key ID
        </label>
        <input
          type="text"
          id="s3AccessKeyId"
          name="accessKeyId"
          value={accessKeyId}
          onChange={(e) => setAccessKeyId(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="AKIAIOSFODNN7EXAMPLE"
          disabled={isSubmitting || isTesting}
          data-testid="s3-access-key-id-input"
        />
      </div>

      {/* Secret Access Key Field */}
      <div>
        <label
          htmlFor="s3SecretAccessKey"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Secret Access Key
        </label>
        <input
          type="password"
          id="s3SecretAccessKey"
          name="secretAccessKey"
          value={secretAccessKey}
          onChange={(e) => setSecretAccessKey(e.target.value)}
          required
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="••••••••••••••••••••••••••••••••"
          disabled={isSubmitting || isTesting}
          data-testid="s3-secret-access-key-input"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Your secret key will be encrypted before storage
        </p>
      </div>

      {/* Endpoint Field (Optional) */}
      <div>
        <label
          htmlFor="s3Endpoint"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Endpoint (Optional)
        </label>
        <input
          type="url"
          id="s3Endpoint"
          name="endpoint"
          value={endpoint}
          onChange={(e) => setEndpoint(e.target.value)}
          className="
            w-full px-3 py-2 border rounded-md
            bg-white dark:bg-gray-800
            border-gray-300 dark:border-gray-600
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          placeholder="https://s3.example.com (for MinIO or custom S3-compatible services)"
          disabled={isSubmitting || isTesting}
          data-testid="s3-endpoint-input"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        {/* Test Connection Button */}
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isSubmitting || isTesting || !bucket || !region || !accessKeyId || !secretAccessKey}
          className="
            px-4 py-2 rounded-md
            bg-gray-600 hover:bg-gray-700
            dark:bg-gray-500 dark:hover:bg-gray-600
            text-white font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            flex items-center gap-2
          "
          data-testid="s3-test-connection-button"
        >
          {isTesting ? (
            <>
              <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Icon icon="mdi:connection" className="w-5 h-5" />
              Test Connection
            </>
          )}
        </button>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || isTesting}
          className="
            px-4 py-2 rounded-md
            bg-indigo-600 hover:bg-indigo-700
            dark:bg-indigo-500 dark:hover:bg-indigo-600
            text-white font-medium
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors duration-150
            flex items-center gap-2
          "
          data-testid="s3-settings-submit"
        >
          {isSubmitting ? (
            <>
              <Icon icon="mdi:loading" className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Icon icon="mdi:content-save" className="w-5 h-5" />
              Save S3 Settings
            </>
          )}
        </button>
      </div>
    </form>
  );
}
