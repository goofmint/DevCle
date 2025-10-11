/**
 * Prettier configuration for DRM core package
 *
 * Enforces consistent code formatting across the project.
 */
export default {
  // Use semicolons at the end of statements
  semi: true,

  // Use single quotes instead of double quotes
  singleQuote: true,

  // Use 2 spaces for indentation
  tabWidth: 2,

  // Add trailing commas where valid in ES5 (objects, arrays, etc.)
  trailingComma: 'es5',

  // Wrap lines at 80 characters
  printWidth: 80,

  // Always include parentheses around arrow function parameters
  arrowParens: 'always',

  // Use Unix line endings (LF)
  endOfLine: 'lf',

  // Add spaces inside object literals: { foo: bar }
  bracketSpacing: true,

  // Put the > of a multi-line JSX element at the end of the last line
  bracketSameLine: false,
};
