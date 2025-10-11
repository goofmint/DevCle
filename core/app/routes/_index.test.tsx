import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Index from './_index';

/**
 * Test suite for the home page component
 *
 * Tests basic rendering and content verification
 */
describe('Index Route', () => {
  it('should render the welcome heading', () => {
    // Render the component
    render(<Index />);

    // Verify the heading is present
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent).toBe('Welcome to DRM');
  });

  it('should render the description text', () => {
    // Render the component
    render(<Index />);

    // Verify the description is present
    const description = screen.getByText(/Developer Relationship Management/i);
    expect(description).toBeDefined();
  });

  it('should have proper semantic HTML structure', () => {
    // Render the component
    const { container } = render(<Index />);

    // Verify div wrapper exists
    const wrapper = container.querySelector('div');
    expect(wrapper).toBeDefined();

    // Verify heading exists
    const heading = container.querySelector('h1');
    expect(heading).toBeDefined();

    // Verify paragraph exists
    const paragraph = container.querySelector('p');
    expect(paragraph).toBeDefined();
  });
});
