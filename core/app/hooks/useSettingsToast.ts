/**
 * Settings Toast Hook
 *
 * Custom hook for managing toast notifications in settings pages.
 * Monitors multiple fetchers and displays success/error messages.
 */

import { useState, useEffect } from 'react';
import type { Fetcher } from '@remix-run/react';
import type { ActionData } from '~/routes/dashboard.settings.server';

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

  // Monitor all fetchers for completion and display toast
  useEffect(() => {
    const fetchers = [
      basicFetcher,
      s3Fetcher,
      smtpFetcher,
      s3TestFetcher,
      smtpTestFetcher,
    ];

    for (const fetcher of fetchers) {
      if (fetcher.data && fetcher.state === 'idle') {
        if (fetcher.data.success) {
          setToast({
            message: TOAST_MESSAGES[fetcher.data.section || ''] || 'Success',
            type: 'success',
          });
        } else if (fetcher.data.error) {
          setToast({
            message: fetcher.data.error,
            type: 'error',
          });
        }
        // Break after first completed fetcher
        break;
      }
    }
  }, [
    basicFetcher.data,
    basicFetcher.state,
    s3Fetcher.data,
    s3Fetcher.state,
    smtpFetcher.data,
    smtpFetcher.state,
    s3TestFetcher.data,
    s3TestFetcher.state,
    smtpTestFetcher.data,
    smtpTestFetcher.state,
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
