import type { MetaFunction } from '@remix-run/node';

/**
 * Meta tags for the home page
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'DRM - Developer Relationship Management' },
    {
      name: 'description',
      content: 'DevRel analytics and relationship management platform',
    },
  ];
};

/**
 * Home page component
 *
 * This is a placeholder page that will be replaced with the actual
 * landing page in Task 2.2
 */
export default function Index(): JSX.Element {
  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        lineHeight: '1.8',
        padding: '2rem',
      }}
    >
      <h1>Welcome to DRM</h1>
      <p>Developer Relationship Management - Coming Soon</p>
    </div>
  );
}
