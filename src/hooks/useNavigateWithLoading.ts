import { useNavigate } from 'react-router-dom';
import { useLoading } from '@/contexts/LoadingContext';
import { useEffect } from 'react';

export function useNavigateWithLoading() {
  const navigate = useNavigate();
  const { startLoading, stopLoading } = useLoading();

  const navigateWithLoading = (to: string, message?: string) => {
    startLoading();
    if (message) {
      // setLoadingMessage(message); // Optional: set custom message
    }
    
    // Use setTimeout to ensure loading state is set before navigation
    setTimeout(() => {
      navigate(to);
      // Stop loading after a brief delay to ensure new page has started mounting
      setTimeout(() => {
        stopLoading();
      }, 100);
    }, 50);
  };

  return navigateWithLoading;
}

/**
 * Hook to manage loading state during route transitions
 * Automatically stops loading when component unmounts
 */
export function useRouteLoading(isLoading: boolean = false) {
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    if (isLoading) {
      startLoading();
    } else {
      stopLoading();
    }

    return () => {
      stopLoading();
    };
  }, [isLoading, startLoading, stopLoading]);
}
