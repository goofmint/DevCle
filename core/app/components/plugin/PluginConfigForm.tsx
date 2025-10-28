/**
 * Plugin Configuration Form Component
 *
 * Dynamically generates form fields based on plugin configuration schema.
 * Supports multiple field types with validation error display.
 */

import type { PluginConfigField } from '../../../plugin-system/config-validator.js';
import { StringField } from './fields/StringField.js';
import { TextareaField } from './fields/TextareaField.js';
import { SecretField } from './fields/SecretField.js';
import { NumberField } from './fields/NumberField.js';
import { BooleanField } from './fields/BooleanField.js';
import { SelectField } from './fields/SelectField.js';

/**
 * Props for PluginConfigForm
 */
interface PluginConfigFormProps {
  /** Plugin configuration schema */
  schema: {
    fields: PluginConfigField[];
  };

  /** Current configuration values (with secret exists markers) */
  config: Record<string, unknown>;

  /** Validation errors from server */
  errors: Array<{ field: string; message: string }>;
}

/**
 * Plugin Configuration Form
 *
 * Renders form fields dynamically based on schema.
 * Each field type is handled by a specialized component.
 */
export function PluginConfigForm({ schema, config, errors }: PluginConfigFormProps) {
  // Create error map for quick lookup
  const errorMap = new Map(errors.map(e => [e.field, e.message]));

  return (
    <div className="space-y-6">
      {schema.fields.map((field) => {
        const value = config[field.name];
        const error = errorMap.get(field.name);

        // Render appropriate field component based on type
        switch (field.type) {
          case 'string':
          case 'url':
          case 'email':
            return (
              <StringField
                key={field.name}
                field={field}
                value={value}
                error={error}
              />
            );

          case 'textarea':
            return (
              <TextareaField
                key={field.name}
                field={field}
                value={value}
                error={error}
              />
            );

          case 'secret':
            return (
              <SecretField
                key={field.name}
                field={field}
                value={value}
                error={error}
              />
            );

          case 'number':
            return (
              <NumberField
                key={field.name}
                field={field}
                value={value}
                error={error}
              />
            );

          case 'boolean':
            return (
              <BooleanField
                key={field.name}
                field={field}
                value={value}
                error={error}
              />
            );

          case 'select':
            return (
              <SelectField
                key={field.name}
                field={field}
                value={value}
                error={error}
              />
            );

          default:
            // Unknown field type - skip
            console.warn(`Unknown field type: ${(field as { type: string }).type}`);
            return null;
        }
      })}
    </div>
  );
}
