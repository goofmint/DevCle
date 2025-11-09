/**
 * Create Token Dialog Component
 *
 * Features:
 * - Form for creating new API token (name, scopes, expiresAt)
 * - One-time token display after creation
 * - Copy to clipboard functionality
 * - Warning message for security
 * - Form validation
 * - Dark/Light mode support
 */

import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';

/**
 * Props for CreateTokenDialog component
 */
interface CreateTokenDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  isSubmitting: boolean;
  createdToken?: string | null; // Plain text token (only shown once)
}

/**
 * Available scopes
 */
const AVAILABLE_SCOPES = ['webhook:write', 'api:read', 'api:write'];

/**
 * Create Token Dialog Component
 */
export function CreateTokenDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  createdToken,
}: CreateTokenDialogProps) {
  // Form state
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset form state when dialog closes
      setTimeout(() => {
        setName('');
        setSelectedScopes([]);
        setExpiresAt('');
        setErrors({});
        setCopied(false);
      }, 300); // Wait for animation
    }
  }, [isOpen]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!name.trim()) {
      newErrors['name'] = 'Name is required';
    } else if (name.length > 100) {
      newErrors['name'] = 'Name must be 100 characters or less';
    }

    // Scopes validation
    if (selectedScopes.length === 0) {
      newErrors['scopes'] = 'At least one scope is required';
    }

    // Expires at validation
    if (expiresAt && new Date(expiresAt) <= new Date()) {
      newErrors['expiresAt'] = 'Expiration date must be in the future';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('scopes', selectedScopes.join(','));
    if (expiresAt) {
      formData.append('expiresAt', new Date(expiresAt).toISOString());
    }

    onSubmit(formData);
  };

  // Handle scope toggle
  const handleScopeToggle = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy token:', error);
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-75 transition-opacity" onClick={onClose}></div>

      {/* Dialog */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
          <form onSubmit={handleSubmit}>
            <div className="bg-white dark:bg-gray-800 px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 sm:mx-0 sm:h-10 sm:w-10">
                  <Icon icon="mdi:key-plus" className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex-1">
                  <h3 className="text-lg font-semibold leading-6 text-gray-900 dark:text-gray-100" id="modal-title">
                    {createdToken ? 'Token Created Successfully' : 'Create API Token'}
                  </h3>

                  {createdToken ? (
                    // Token created - show token
                    <div className="mt-4 space-y-4">
                      <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4">
                        <div className="flex">
                          <div className="flex-shrink-0">
                            <Icon icon="mdi:alert" className="h-5 w-5 text-yellow-400" aria-hidden="true" />
                          </div>
                          <div className="ml-3">
                            <p className="text-sm text-yellow-700 dark:text-yellow-400">
                              ⚠️ This token will only be shown once. Make sure to copy it now and store it securely.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Your API Token
                        </label>
                        <div className="relative">
                          <code className="block w-full p-3 pr-12 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md font-mono text-sm break-all">
                            {createdToken}
                          </code>
                          <button
                            type="button"
                            onClick={handleCopy}
                            className="absolute right-2 top-2 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            title="Copy to clipboard"
                          >
                            <Icon icon={copied ? 'mdi:check' : 'mdi:content-copy'} className="h-5 w-5" />
                          </button>
                        </div>
                        {copied && (
                          <p className="mt-1 text-sm text-green-600 dark:text-green-400">Copied to clipboard!</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Create form
                    <div className="mt-4 space-y-4">
                      {/* Name field */}
                      <div>
                        <label htmlFor="token-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          id="token-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                            errors['name']
                              ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
                          } dark:bg-gray-700 dark:text-gray-100`}
                          placeholder="e.g., Production Webhook"
                          maxLength={100}
                        />
                        {errors['name'] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['name']}</p>}
                      </div>

                      {/* Scopes field */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Scopes <span className="text-red-500">*</span>
                        </label>
                        <div className="space-y-2">
                          {AVAILABLE_SCOPES.map((scope) => (
                            <label key={scope} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={selectedScopes.includes(scope)}
                                onChange={() => handleScopeToggle(scope)}
                                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
                              />
                              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{scope}</span>
                            </label>
                          ))}
                        </div>
                        {errors['scopes'] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['scopes']}</p>}
                      </div>

                      {/* Expires at field */}
                      <div>
                        <label htmlFor="token-expires-at" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Expires At (Optional)
                        </label>
                        <input
                          type="date"
                          id="token-expires-at"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                          className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm ${
                            errors['expiresAt']
                              ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500'
                              : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500'
                          } dark:bg-gray-700 dark:text-gray-100`}
                        />
                        {errors['expiresAt'] && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors['expiresAt']}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-2">
              {createdToken ? (
                // Close button after token created
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto"
                >
                  Close
                </button>
              ) : (
                // Create and Cancel buttons
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Token'}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 sm:mt-0 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
