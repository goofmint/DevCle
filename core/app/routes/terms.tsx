import type { MetaFunction } from '@remix-run/node';
import { Link } from '@remix-run/react';
import { useState, useEffect } from 'react';

/**
 * Meta tags for SEO optimization
 * Provides title and description for the terms of service page
 */
export const meta: MetaFunction = () => {
  return [
    { title: 'Terms of Service - DevCle' },
    {
      name: 'description',
      content:
        'DevCle利用規約。サービスの利用条件、ユーザーの権利と義務について説明します。',
    },
  ];
};

/**
 * Props for the TermsHeader component
 * Defines the page title and last updated date
 */
interface TermsHeaderProps {
  title: string;
  lastUpdated: string;
  isDark: boolean;
  toggleDark: () => void;
}

/**
 * TermsHeader component
 * Displays the page title, last updated date, and navigation links
 * Includes a link back to the home page and dark mode toggle
 */
function TermsHeader({
  title,
  lastUpdated,
  isDark,
  toggleDark,
}: TermsHeaderProps): JSX.Element {
  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 ${
        isDark ? 'bg-gray-900' : 'bg-white'
      } border-b ${isDark ? 'border-gray-800' : 'border-gray-200'} transition-colors`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Left side: Back to home link */}
          <Link
            to="/"
            className={`flex items-center space-x-2 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors ${
              isDark
                ? 'text-blue-400 hover:text-blue-300'
                : 'text-blue-600 hover:text-blue-700'
            }`}
            aria-label="Back to home"
          >
            <span aria-hidden="true">←</span>
            <span className="font-semibold">Back to Home</span>
          </Link>

          {/* Right side: Dark mode toggle */}
          <button
            onClick={toggleDark}
            className={`p-2 rounded-lg ${
              isDark
                ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            } transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              // Sun icon for light mode
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Page title and last updated - displayed below the navigation bar */}
      <div
        className={`border-b ${
          isDark ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'
        } transition-colors`}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1
            className={`text-3xl md:text-4xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {title}
          </h1>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Last Updated: {lastUpdated}
          </p>
        </div>
      </div>
    </header>
  );
}

/**
 * TermsSection interface
 * Represents a single section in the terms of service
 * Each section has an ID, title, and content (can be a single string or array of strings)
 */
interface TermsSection {
  id: string;
  title: string;
  content: string[];
}

/**
 * Props for the TermsContent component
 * Contains an array of terms sections to display
 */
interface TermsContentProps {
  sections: TermsSection[];
  isDark: boolean;
}

/**
 * TermsContent component
 * Displays the terms of service content in a readable format
 * Each section is rendered with a heading and paragraphs
 * Uses semantic HTML for accessibility (article, section, h2, p)
 */
function TermsContent({ sections, isDark }: TermsContentProps): JSX.Element {
  return (
    <article
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8"
      role="article"
      aria-label="Terms of Service content"
    >
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="mb-12"
          aria-labelledby={`heading-${section.id}`}
        >
          <h2
            id={`heading-${section.id}`}
            className={`text-2xl font-semibold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {section.title}
          </h2>
          <div className="space-y-4">
            {section.content.map((paragraph, index) => (
              <p
                key={`${section.id}-p-${index}`}
                className={`leading-relaxed ${
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }`}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

/**
 * FooterLink interface
 * Represents a single link in the footer
 */
interface FooterLink {
  text: string;
  href: string;
}

/**
 * Props for the Footer component
 * Contains footer links and copyright text
 */
interface FooterProps {
  links: FooterLink[];
  copyright: string;
  isDark: boolean;
}

/**
 * Footer component
 * Displays footer links (Terms, Privacy, etc.) and copyright notice
 * Uses semantic HTML for accessibility with dark mode support
 * Reused from the landing page for consistency
 */
function Footer({ links, copyright, isDark }: FooterProps): JSX.Element {
  return (
    <footer
      className={`py-8 px-4 sm:px-6 lg:px-8 transition-colors ${
        isDark ? 'bg-gray-950 text-gray-300' : 'bg-gray-800 text-white'
      }`}
      role="contentinfo"
    >
      <div className="max-w-7xl mx-auto">
        <nav
          className="flex flex-wrap justify-center gap-6 mb-4"
          aria-label="Footer navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={`transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 rounded ${
                isDark
                  ? 'hover:text-blue-400 focus:ring-blue-400 focus:ring-offset-gray-950'
                  : 'hover:text-blue-400 focus:ring-blue-400 focus:ring-offset-gray-800'
              }`}
              aria-label={link.text}
            >
              {link.text}
            </Link>
          ))}
        </nav>
        <p
          className={`text-center text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
        >
          {copyright}
        </p>
      </div>
    </footer>
  );
}

/**
 * Terms of Service Page component
 * Main entry point for the /terms route
 *
 * Structure:
 * - Fixed header with back-to-home link and dark mode toggle
 * - Page title and last updated date
 * - 10 sections of terms of service content
 * - Footer with links to related pages
 *
 * Features:
 * - Dark mode support with localStorage persistence
 * - Responsive design for mobile, tablet, and desktop
 * - Semantic HTML for accessibility
 * - ARIA labels for screen readers
 * - Keyboard navigation support
 *
 * Terms Sections:
 * 1. Scope of Application (適用範囲)
 * 2. Definitions (定義)
 * 3. User Registration (利用登録)
 * 4. Privacy and Data Protection (プライバシーとデータ保護)
 * 5. Prohibited Actions (禁止事項)
 * 6. Service Changes and Suspension (サービスの変更・停止)
 * 7. Disclaimer (免責事項)
 * 8. Intellectual Property Rights (知的財産権)
 * 9. Governing Law and Jurisdiction (準拠法と管轄裁判所)
 * 10. Changes to Terms (規約の変更)
 *
 * Accessibility:
 * - Semantic HTML elements (header, article, section, footer)
 * - ARIA labels for all interactive elements
 * - Heading hierarchy (h1 → h2)
 * - Focus states for keyboard navigation
 *
 * Responsive Design:
 * - Mobile-first approach
 * - Max-width container for readability
 * - Adequate padding and spacing
 */
export default function Terms(): JSX.Element {
  // Dark mode state management
  // Initializes from localStorage or system preference (prefers-color-scheme)
  const [isDark, setIsDark] = useState<boolean>(false);

  // Load dark mode preference on mount
  // Priority: 1. localStorage (user preference), 2. System preference (prefers-color-scheme)
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      // User has explicitly set a preference - use it
      setIsDark(savedMode === 'true');
    } else {
      // No saved preference - use system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(prefersDark);
    }
  }, []);

  // Toggle dark mode and persist to localStorage
  const toggleDark = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    localStorage.setItem('darkMode', String(newMode));
  };

  // Terms of service content
  // Each section represents one article (条) of the terms
  // Content is bilingual (Japanese first, then English translation)
  const termsSection: TermsSection[] = [
    {
      id: 'article-1',
      title: '第1条（適用範囲） / Article 1 (Scope of Application)',
      content: [
        'この利用規約（以下「本規約」といいます）は、DevCle（以下「当サービス」といいます）の提供者（以下「当社」といいます）が提供するすべてのサービスの利用条件を定めるものです。',
        'These Terms of Service (hereinafter referred to as "Terms") define the conditions for using all services provided by DevCle (hereinafter referred to as "the Service") and its provider (hereinafter referred to as "the Company").',
        '当サービスにはオープンソース版（以下「OSS版」）とクラウドサービス版（以下「SaaS版」）があり、本規約は両方に適用されます。ただし、料金や機能については各版の説明に従うものとします。',
        'The Service includes an Open Source version (hereinafter referred to as "OSS version") and a Cloud Service version (hereinafter referred to as "SaaS version"), and these Terms apply to both. However, pricing and features shall follow the description of each version.',
        '登録ユーザーは、本規約に同意した上でサービスを利用するものとします。',
        'Registered users shall use the Service after agreeing to these Terms.',
      ],
    },
    {
      id: 'article-2',
      title: '第2条（定義） / Article 2 (Definitions)',
      content: [
        '本規約において使用する用語の定義は、以下の通りとします。',
        'The definitions of terms used in these Terms are as follows:',
        '(1) ユーザー：当サービスを利用するすべての個人または法人',
        '(1) User: Any individual or legal entity that uses the Service',
        '(2) コンテンツ：ユーザーが当サービスを通じて投稿、保存、またはアクセスするすべてのデータ、テキスト、画像、その他の情報',
        '(2) Content: All data, text, images, and other information that users post, save, or access through the Service',
        '(3) テナント：SaaS版において、ユーザーごとに割り当てられるデータの論理的な分離単位',
        '(3) Tenant: A logical unit of data separation assigned to each user in the SaaS version',
        '(4) 開発者データ：当サービスに登録された開発者に関する情報、アクティビティ、識別子などのデータ',
        '(4) Developer Data: Data such as information, activities, and identifiers related to developers registered in the Service',
      ],
    },
    {
      id: 'article-3',
      title: '第3条（利用登録） / Article 3 (User Registration)',
      content: [
        'ユーザーは、当社が定める方法により利用登録を申請し、当社がこれを承認することで、サービスの利用を開始できます。',
        'Users can start using the Service by applying for user registration through the method specified by the Company and receiving approval from the Company.',
        'ユーザーは、登録時に提供する情報が正確かつ最新であることを保証し、変更があった場合は速やかに更新するものとします。',
        'Users shall ensure that the information provided at registration is accurate and up-to-date, and shall promptly update it if there are any changes.',
        'ユーザーは、自己の責任においてユーザーIDおよびパスワードを管理し、第三者に使用させてはなりません。',
        'Users shall manage their user ID and password at their own responsibility and shall not allow third parties to use them.',
        'ユーザーIDおよびパスワードの使用によって生じた損害について、当社は一切の責任を負いません。',
        'The Company shall not be liable for any damages arising from the use of user IDs and passwords.',
      ],
    },
    {
      id: 'article-4',
      title: '第4条（プライバシーとデータ保護） / Article 4 (Privacy and Data Protection)',
      content: [
        '当社は、ユーザーの個人情報を別途定めるプライバシーポリシーに従って取り扱います。',
        'The Company shall handle users\' personal information in accordance with the separately defined Privacy Policy.',
        'ユーザーが当サービスに登録した開発者データおよびその他のコンテンツの所有権は、ユーザーに帰属します。',
        'Ownership of developer data and other content registered by users in the Service belongs to the users.',
        'ユーザーは、いつでも自己のデータをエクスポートし、ダウンロードする権利を有します。',
        'Users have the right to export and download their own data at any time.',
        '当社は、サービスの提供、改善、セキュリティ確保のために、ユーザーデータを処理することができます。',
        'The Company may process user data for the purpose of providing, improving, and securing the Service.',
      ],
    },
    {
      id: 'article-5',
      title: '第5条（禁止事項） / Article 5 (Prohibited Actions)',
      content: [
        'ユーザーは、当サービスの利用にあたり、以下の行為を行ってはなりません。',
        'Users shall not engage in the following actions when using the Service:',
        '(1) 法令または公序良俗に違反する行為',
        '(1) Actions that violate laws or public order and morals',
        '(2) 当社または第三者の知的財産権、プライバシー権、その他の権利を侵害する行為',
        '(2) Actions that infringe on intellectual property rights, privacy rights, or other rights of the Company or third parties',
        '(3) 当サービスのサーバーまたはネットワークに過度な負荷をかける行為',
        '(3) Actions that place excessive load on the servers or networks of the Service',
        '(4) 不正アクセス、クラッキング、リバースエンジニアリングなどの技術的攻撃行為',
        '(4) Technical attacks such as unauthorized access, cracking, or reverse engineering',
        '(5) スパム、フィッシング、その他の迷惑行為',
        '(5) Spam, phishing, or other nuisance activities',
        '(6) 当サービスの運営を妨害する行為',
        '(6) Actions that interfere with the operation of the Service',
      ],
    },
    {
      id: 'article-6',
      title:
        '第6条（サービスの変更・停止） / Article 6 (Service Changes and Suspension)',
      content: [
        '当社は、ユーザーへの事前通知なく、当サービスの内容を変更、追加、または削除することができます。',
        'The Company may change, add, or delete the content of the Service without prior notice to users.',
        '当社は、以下のいずれかに該当する場合、ユーザーへの事前通知なく、当サービスの全部または一部を停止することができます。',
        'The Company may suspend all or part of the Service without prior notice to users if any of the following applies:',
        '(1) システムの保守、点検、または更新を行う場合',
        '(1) When performing system maintenance, inspection, or updates',
        '(2) 地震、火災、停電、その他の不可抗力により当サービスの提供が困難になった場合',
        '(2) When it becomes difficult to provide the Service due to earthquakes, fires, power outages, or other force majeure events',
        '(3) その他、当社が停止を必要と判断した場合',
        '(3) When the Company deems suspension necessary for other reasons',
        '当社は、当サービスを終了する場合、少なくとも30日前までにユーザーに通知するものとします。',
        'If the Company terminates the Service, it shall notify users at least 30 days in advance.',
      ],
    },
    {
      id: 'article-7',
      title: '第7条（免責事項） / Article 7 (Disclaimer)',
      content: [
        '当社は、当サービスが常に利用可能であること、エラーが発生しないこと、または欠陥が修正されることを保証しません。',
        'The Company does not guarantee that the Service will always be available, error-free, or that defects will be corrected.',
        'OSS版については、「現状有姿」で提供されるものとし、当社は明示または黙示を問わず、いかなる保証も行いません。',
        'The OSS version is provided "as is," and the Company makes no warranties, express or implied.',
        '当社は、当サービスの利用によって生じた直接的、間接的、偶発的、特別、または結果的な損害について、一切の責任を負いません。',
        'The Company shall not be liable for any direct, indirect, incidental, special, or consequential damages arising from the use of the Service.',
        'ユーザーは、自己の責任において当サービスを利用し、適切なバックアップを行うものとします。',
        'Users shall use the Service at their own responsibility and perform appropriate backups.',
      ],
    },
    {
      id: 'article-8',
      title: '第8条（知的財産権） / Article 8 (Intellectual Property Rights)',
      content: [
        '当サービスのOSS版は、MITライセンスまたはBSL（Business Source License）のもとで提供されます。ライセンスの詳細は、GitHubリポジトリをご参照ください。',
        'The OSS version of the Service is provided under the MIT License or BSL (Business Source License). Please refer to the GitHub repository for license details.',
        'SaaS版に関するすべての知的財産権は、当社または当社にライセンスを許諾している第三者に帰属します。',
        'All intellectual property rights related to the SaaS version belong to the Company or third parties who have granted licenses to the Company.',
        'ユーザーは、当サービスに投稿したコンテンツについて、当社に対して非独占的、無償、永続的、取消不能のライセンスを付与するものとします。',
        'Users grant the Company a non-exclusive, royalty-free, perpetual, and irrevocable license for content posted to the Service.',
        'ユーザーは、当社の書面による事前の許可なく、当サービスの商標、ロゴ、その他の識別表示を使用してはなりません。',
        'Users shall not use the Service\'s trademarks, logos, or other identifying marks without prior written permission from the Company.',
      ],
    },
    {
      id: 'article-9',
      title:
        '第9条（準拠法と管轄裁判所） / Article 9 (Governing Law and Jurisdiction)',
      content: [
        '本規約の解釈および適用は、日本法に準拠するものとします。',
        'The interpretation and application of these Terms shall be governed by Japanese law.',
        '本規約に関する紛争については、東京地方裁判所を第一審の専属管轄裁判所とします。',
        'The Tokyo District Court shall have exclusive jurisdiction as the court of first instance for any disputes related to these Terms.',
      ],
    },
    {
      id: 'article-10',
      title: '第10条（規約の変更） / Article 10 (Changes to Terms)',
      content: [
        '当社は、必要に応じて本規約を変更することができます。',
        'The Company may change these Terms as necessary.',
        '本規約を変更する場合、当社は変更内容および変更後の規約の効力発生日を、当サービス上または電子メールにて通知します。',
        'When changing these Terms, the Company will notify the changes and the effective date of the revised Terms on the Service or via email.',
        'ユーザーが変更後の規約の効力発生日以降に当サービスを利用した場合、変更後の規約に同意したものとみなします。',
        'If users use the Service after the effective date of the revised Terms, they shall be deemed to have agreed to the revised Terms.',
      ],
    },
  ];

  // Footer links data
  // Links to related legal pages
  const footerLinks: FooterLink[] = [
    { text: 'Home', href: '/' },
    { text: 'Terms of Service', href: '/terms' },
    { text: 'Privacy Policy', href: '/privacy' },
  ];

  return (
    <div
      className={`min-h-screen transition-colors ${isDark ? 'bg-gray-900' : 'bg-white'}`}
    >
      {/* Fixed header with back-to-home link and dark mode toggle */}
      <TermsHeader
        title="利用規約 / Terms of Service"
        lastUpdated="October 12, 2025"
        isDark={isDark}
        toggleDark={toggleDark}
      />

      {/* Main content area with proper spacing for fixed header */}
      {/* mt-48: accounts for header height (h-16) + title section height */}
      <main className="pt-48 pb-16">
        {/* Terms of service content */}
        <TermsContent sections={termsSection} isDark={isDark} />
      </main>

      {/* Footer with legal links and copyright */}
      <Footer
        links={footerLinks}
        copyright="© 2025 DevCle. All rights reserved."
        isDark={isDark}
      />
    </div>
  );
}
