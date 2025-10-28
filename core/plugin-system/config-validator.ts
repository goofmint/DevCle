/**
 * Plugin Configuration Validator
 *
 * Validates plugin configuration values against schema definitions.
 * Supports type checking, required field validation, and format validation.
 *
 * Key Features:
 * - Non-fail-fast validation (collects all errors)
 * - Support for multiple field types (string, textarea, secret, number, boolean, url, email, select)
 * - Regex pattern validation
 * - Length and range validation
 * - URL and email format validation
 */

/**
 * Supported plugin configuration field types
 */
export type PluginConfigFieldType =
  | 'string'      // Single-line text input
  | 'textarea'    // Multi-line text input
  | 'secret'      // Sensitive data (encrypted storage, masked UI)
  | 'number'      // Numeric value
  | 'boolean'     // True/false toggle
  | 'url'         // URL with format validation
  | 'email'       // Email address with format validation
  | 'select';     // Dropdown selection (requires options)

/**
 * Plugin configuration field definition
 */
export interface PluginConfigField {
  /** Field identifier (used as key in config object) */
  key: string;

  /** Display label for UI */
  label: string;

  /** Field type (determines validation and UI component) */
  type: PluginConfigFieldType;

  /** Whether field is required */
  required: boolean;

  /** Default value (used if field is not provided) */
  default?: string | number | boolean;

  /** Help text displayed in UI */
  help?: string;

  /** Placeholder text for input fields */
  placeholder?: string;

  /** Options for select field (required when type is 'select') */
  options?: Array<{ label: string; value: string | number }>;

  /** Validation rules */
  validation?: {
    /** Minimum value (for numbers) */
    min?: number;

    /** Maximum value (for numbers) */
    max?: number;

    /** Minimum length (for strings) */
    minLength?: number;

    /** Maximum length (for strings) */
    maxLength?: number;

    /** Regex pattern (for strings) */
    pattern?: string;
  };
}

/**
 * Plugin configuration schema (from plugin.json settingsSchema)
 */
export interface PluginConfigSchema {
  fields: PluginConfigField[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** Field name that failed validation */
  field: string;

  /** Human-readable error message */
  message: string;
}

/**
 * Validate plugin configuration against schema
 *
 * This function performs comprehensive validation of all fields
 * and collects all errors (non-fail-fast approach).
 *
 * @param schema - Plugin configuration schema
 * @param config - Configuration values to validate
 * @returns Array of validation errors (empty if valid)
 * @throws Error if schema is invalid
 */
export function validatePluginConfig(
  schema: PluginConfigSchema,
  config: Record<string, unknown>
): ValidationError[] {
  // Validate schema structure
  if (!schema || !Array.isArray(schema.fields)) {
    throw new Error('Invalid schema: fields must be an array');
  }

  const errors: ValidationError[] = [];

  // Validate each field in schema
  for (const field of schema.fields) {
    const value = config[field.key];

    // Trim string values for required check and empty check
    // (but keep original value for subsequent validation)
    const trimmedValue = typeof value === 'string' ? value.trim() : value;

    // Check required fields (use trimmed value for strings)
    if (field.required && (trimmedValue === undefined || trimmedValue === null || trimmedValue === '')) {
      errors.push({
        field: field.key,
        message: `${field.label} is required`,
      });
      continue;
    }

    // Skip validation if field is not provided and not required (use trimmed value for strings)
    if (trimmedValue === undefined || trimmedValue === null || trimmedValue === '') {
      continue;
    }

    // Validate field based on type
    const fieldErrors = validateField(field, value);
    errors.push(...fieldErrors);
  }

  return errors;
}

/**
 * Validate individual field value
 *
 * Delegates to type-specific validation functions.
 *
 * @param field - Field definition
 * @param value - Field value to validate
 * @returns Array of validation errors for this field
 */
export function validateField(
  field: PluginConfigField,
  value: unknown
): ValidationError[] {
  switch (field.type) {
    case 'string':
    case 'textarea':
    case 'secret':
    case 'url':
    case 'email':
      return validateStringField(field, value);

    case 'number':
      return validateNumberField(field, value);

    case 'boolean':
      return validateBooleanField(field, value);

    case 'select':
      return validateSelectField(field, value);

    default:
      // Type guard ensures this is unreachable
      return [{
        field: field.key,
        message: `Unknown field type: ${(field as { type: string }).type}`,
      }];
  }
}

/**
 * Validate string-based fields (string, textarea, secret, url, email)
 *
 * Performs:
 * - Type check (must be string)
 * - Length validation (minLength, maxLength)
 * - Pattern validation (regex)
 * - Format validation (URL, email)
 *
 * @param field - Field definition
 * @param value - Value to validate
 * @returns Array of validation errors
 */
export function validateStringField(
  field: PluginConfigField,
  value: unknown
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Type check
  if (typeof value !== 'string') {
    errors.push({
      field: field.key,
      message: `${field.label} must be a string`,
    });
    return errors;
  }

  // Length validation
  if (field.validation?.minLength !== undefined && value.length < field.validation.minLength) {
    errors.push({
      field: field.key,
      message: `${field.label} must be at least ${field.validation.minLength} characters`,
    });
  }

  if (field.validation?.maxLength !== undefined && value.length > field.validation.maxLength) {
    errors.push({
      field: field.key,
      message: `${field.label} must be at most ${field.validation.maxLength} characters`,
    });
  }

  // Pattern validation
  if (field.validation?.pattern) {
    try {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        errors.push({
          field: field.key,
          message: `${field.label} format is invalid`,
        });
      }
    } catch (error) {
      throw new Error(
        `Invalid regex pattern for field ${field.key}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // URL format validation
  if (field.type === 'url') {
    try {
      new URL(value);
    } catch {
      errors.push({
        field: field.key,
        message: `${field.label} must be a valid URL`,
      });
    }
  }

  // Email format validation
  if (field.type === 'email') {
    // Simple email regex (RFC 5322 simplified)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      errors.push({
        field: field.key,
        message: `${field.label} must be a valid email address`,
      });
    }
  }

  return errors;
}

/**
 * Validate number field
 *
 * Performs:
 * - Type check (must be number)
 * - Range validation (min, max)
 *
 * @param field - Field definition
 * @param value - Value to validate
 * @returns Array of validation errors
 */
export function validateNumberField(
  field: PluginConfigField,
  value: unknown
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Type check
  if (typeof value !== 'number') {
    errors.push({
      field: field.key,
      message: `${field.label} must be a number`,
    });
    return errors;
  }

  // NaN check
  if (Number.isNaN(value)) {
    errors.push({
      field: field.key,
      message: `${field.label} must be a valid number`,
    });
    return errors;
  }

  // Range validation
  if (field.validation?.min !== undefined && value < field.validation.min) {
    errors.push({
      field: field.key,
      message: `${field.label} must be at least ${field.validation.min}`,
    });
  }

  if (field.validation?.max !== undefined && value > field.validation.max) {
    errors.push({
      field: field.key,
      message: `${field.label} must be at most ${field.validation.max}`,
    });
  }

  return errors;
}

/**
 * Validate boolean field
 *
 * Performs:
 * - Type check (must be boolean)
 *
 * @param field - Field definition
 * @param value - Value to validate
 * @returns Array of validation errors
 */
export function validateBooleanField(
  field: PluginConfigField,
  value: unknown
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Type check
  if (typeof value !== 'boolean') {
    errors.push({
      field: field.key,
      message: `${field.label} must be true or false`,
    });
  }

  return errors;
}

/**
 * Validate select field
 *
 * Performs:
 * - Options existence check (field must have options)
 * - Value in options check (value must be one of the allowed options)
 *
 * @param field - Field definition
 * @param value - Value to validate
 * @returns Array of validation errors
 */
export function validateSelectField(
  field: PluginConfigField,
  value: unknown
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check that options are defined
  if (!field.options || field.options.length === 0) {
    throw new Error(`Select field ${field.key} must have options defined`);
  }

  // Check that value is one of the allowed options
  // Coerce both sides to strings for comparison (value is always string from form, but option values may be numbers)
  const allowedValues = field.options.map(opt => String(opt.value));
  if (!allowedValues.includes(String(value || ''))) {
    errors.push({
      field: field.key,
      message: `${field.label} must be one of: ${field.options.map(opt => opt.value).join(', ')}`,
    });
  }

  return errors;
}
