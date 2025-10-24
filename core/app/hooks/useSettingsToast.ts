/**
 * Settings Toast Hook
 *
 * Custom hook for managing toast notifications in settings pages.
 * Monitors multiple fetchers and displays success/error messages.
 */

import { useState, useEffect, useRef } from 'react';
import type { Fetcher } from '@remix-run/react';
import type { ActionData } from '~/routes/dashboard.settings';

/**
 * Hook Props
 */
interface UseSettingsToastProps {
  basicFetcher: Fetcher<ActionData>;
  s3Fetcher: Fetcher<ActionData>;
  smtpFetcher: Fetcher<ActionData>;
  s3TestFetcher: Fetcher<ActionData>;
  smtpTestFetcher: Fetcher<ActionData>;
}

/**
 * Toast State
 */
export interface ToastState {
  message: string;
  type: 'success' | 'error';
  section: 'basic' | 's3' | 'smtp' | 's3-test' | 'smtp-test';
}

/**
 * Toast Messages Map
 */
const TOAST_MESSAGES: Record<string, string> = {
  basic: 'Basic settings saved successfully',
  s3: 'S3 settings saved successfully',
  smtp: 'SMTP settings saved successfully',
  's3-test': 'S3 connection test passed',
  'smtp-test': 'SMTP connection test passed',
};

/**
 * useSettingsToast Hook
 *
 * Monitors all fetchers and displays appropriate toast notifications.
 * Auto-dismisses toasts after 5 seconds.
 *
 * @param props - Fetchers to monitor
 * @returns Toast state
 */
export function useSettingsToast(props: UseSettingsToastProps) {
  const { basicFetcher, s3Fetcher, smtpFetcher, s3TestFetcher, smtpTestFetcher } = props;
  const [toast, setToast] = useState<ToastState | null>(null);

  // Track previous states to detect transitions
  const prevStates = useRef({
    basic: 'idle',
    s3: 'idle',
    smtp: 'idle',
    's3-test': 'idle',
    'smtp-test': 'idle',
  });

  // Monitor all fetchers for state transitions (submitting → idle)
  useEffect(() => {
    const fetchers = [
      { fetcher: basicFetcher, key: 'basic' as const },
      { fetcher: s3Fetcher, key: 's3' as const },
      { fetcher: smtpFetcher, key: 'smtp' as const },
      { fetcher: s3TestFetcher, key: 's3-test' as const },
      { fetcher: smtpTestFetcher, key: 'smtp-test' as const },
    ];

    for (const { fetcher, key } of fetchers) {
      const prevState = prevStates.current[key];
      const currentState = fetcher.state;

      // Detect transition from submitting/loading to idle
      if ((prevState === 'submitting' || prevState === 'loading') && currentState === 'idle') {
        // Fetcher just completed, check data
        if (fetcher.data) {
          const section = (fetcher.data.section || key) as 'basic' | 's3' | 'smtp' | 's3-test' | 'smtp-test';
          if (fetcher.data.success) {
            setToast({
              message: TOAST_MESSAGES[fetcher.data.section || key] || 'Success',
              type: 'success',
              section,
            });
          } else if (fetcher.data.error) {
            setToast({
              message: fetcher.data.error,
              type: 'error',
              section,
            });
          }
        }
      }

      // Update previous state
      prevStates.current[key] = currentState;
    }
  }, [
    basicFetcher.state,
    basicFetcher.data,
    s3Fetcher.state,
    s3Fetcher.data,
    smtpFetcher.state,
    smtpFetcher.data,
    s3TestFetcher.state,
    s3TestFetcher.data,
    smtpTestFetcher.state,
    smtpTestFetcher.data,
  ]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return { toast };
}
