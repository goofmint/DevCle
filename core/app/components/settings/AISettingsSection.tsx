/**
 * AI Settings Section Component
 *
 * Renders form fields for AI provider configuration:
 * - AI provider (select: openai, anthropic, google)
 * - AI API key (password input, masked)
 * - AI model (text input)
 *
 * Features:
 * - Dark/light mode support
 * - API key masking for security
 * - Provider dropdown with enum validation
 */

import { Icon } from '@iconify/react';

export interface AISettingsSectionProps {
  aiProvider: string;
  aiApiKey: string;
  aiModel: string;
}

const AI_PROVIDERS = [
  { value: '', label: 'Select a provider...' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
];

export function AISettingsSection({ aiProvider, aiApiKey, aiModel }: AISettingsSectionProps) {
  return (
    <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Icon icon="mdi:brain" className="w-6 h-6 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          AI Settings
        </h2>
      </div>

      <div className="space-y-4">
        {/* AI Provider */}
        <div>
          <label
            htmlFor="aiProvider"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            AI Provider
          </label>
          <select
            id="aiProvider"
            name="aiProvider"
            defaultValue={aiProvider}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          >
            {AI_PROVIDERS.map((provider) => (
              <option key={provider.value} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>

        {/* AI API Key */}
        <div>
          <label
            htmlFor="aiApiKey"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            AI API Key
          </label>
          <input
            type="password"
            id="aiApiKey"
            name="aiApiKey"
            defaultValue={aiApiKey}
            placeholder="sk-••••••••••••••••••••••••••••••••"
            autoComplete="off"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            API key is encrypted before storage
          </p>
        </div>

        {/* AI Model */}
        <div>
          <label
            htmlFor="aiModel"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            AI Model
          </label>
          <input
            type="text"
            id="aiModel"
            name="aiModel"
            defaultValue={aiModel}
            placeholder="gpt-4-turbo, claude-3-opus-20240229, gemini-pro, etc."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Model identifier from your chosen provider
          </p>
        </div>
      </div>
    </section>
  );
}
