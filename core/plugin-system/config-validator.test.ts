/**
 * Unit tests for Plugin Configuration Validator
 *
 * Tests the field.key fix - ensuring validator uses "key" not "name"
 */

import { describe, it, expect } from 'vitest';
import { validatePluginConfig, type PluginConfigSchema } from './config-validator.js';

describe('validatePluginConfig - field.key fix', () => {
  // Test schema with key property (matches plugin.json structure)
  const testSchema: PluginConfigSchema = {
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'secret',
        required: true,
        help: 'Enter your API key',
      },
      {
        key: 'webhookUrl',
        label: 'Webhook URL',
        type: 'url',
        required: false,
        help: 'Optional webhook URL',
      },
      {
        key: 'maxRetries',
        label: 'Max Retries',
        type: 'number',
        required: false,
        validation: {
          min: 0,
          max: 10,
        },
      },
    ],
  };

  it('should validate successfully when required field has value', () => {
    const config = {
      apiKey: 'test-api-key-123',
    };

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(0);
  });

  it('should return error when required field is missing', () => {
    const config = {};

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'apiKey',
      message: 'API Key is required',
    });
  });

  it('should validate field using key property not name property', () => {
    // This is the core fix - validator must use field.key
    const config = {
      apiKey: 'aaa', // Using the key from schema
    };

    const errors = validatePluginConfig(testSchema, config);

    // Should NOT have "required" error because value exists
    expect(errors).toHaveLength(0);
  });

  it('should validate multiple fields correctly', () => {
    const config = {
      apiKey: 'test-key',
      webhookUrl: 'https://example.com/webhook',
      maxRetries: 5,
    };

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(0);
  });

  it('should return field-specific error messages', () => {
    const config = {
      apiKey: 'valid-key',
      webhookUrl: 'invalid-url', // Invalid URL format
    };

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(1);
    const error = errors[0]!;
    expect(error).toBeDefined();
    expect(error.field).toBe('webhookUrl');
    expect(error.message).toContain('valid URL');
  });

  it('should validate number field range using key', () => {
    const config = {
      apiKey: 'valid-key',
      maxRetries: 15, // Exceeds max of 10
    };

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(1);
    const error = errors[0]!;
    expect(error).toBeDefined();
    expect(error.field).toBe('maxRetries');
    expect(error.message).toContain('at most 10');
  });

  it('should handle empty string as missing for required field', () => {
    const config = {
      apiKey: '', // Empty string should be treated as missing
    };

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'apiKey',
      message: 'API Key is required',
    });
  });

  it('should not error on optional field when missing', () => {
    const config = {
      apiKey: 'valid-key',
      // webhookUrl and maxRetries are optional
    };

    const errors = validatePluginConfig(testSchema, config);

    expect(errors).toHaveLength(0);
  });
});
