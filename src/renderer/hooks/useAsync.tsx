import React, { useState, useCallback } from 'react';

interface AsyncState<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
}

interface UseAsyncReturn<T> {
    data: T | null;
    loading: boolean;
    error: Error | null;
    execute: (...args: any[]) => Promise<T | void>;
    reset: () => void;
}

/**
 * Custom hook for handling async operations with loading and error states
 * 
 * @example
 * const { data, loading, error, execute } = useAsync(async () => {
 *   return await ipcAPI.employer.get();
 * });
 * 
 * useEffect(() => {
 *   execute();
 * }, []);
 */
export function useAsync<T>(
    asyncFunction: (...args: any[]) => Promise<T>
): UseAsyncReturn<T> {
    const [state, setState] = useState<AsyncState<T>>({
        data: null,
        loading: false,
        error: null
    });

    const execute = useCallback(
        async (...args: any[]) => {
            setState({ data: null, loading: true, error: null });

            try {
                const result = await asyncFunction(...args);
                setState({ data: result, loading: false, error: null });
                return result;
            } catch (error) {
                setState({ data: null, loading: false, error: error as Error });
                throw error;
            }
        },
        [asyncFunction]
    );

    const reset = useCallback(() => {
        setState({ data: null, loading: false, error: null });
    }, []);

    return {
        ...state,
        execute,
        reset
    };
}

/**
 * Loading Spinner Component
 */
export const LoadingSpinner: React.FC<{ size?: 'small' | 'medium' | 'large' }> = ({
    size = 'medium'
}) => {
    const sizes = {
        small: '20px',
        medium: '40px',
        large: '60px'
    };

    return (
        <div style={{
            display: 'inline-block',
            width: sizes[size],
            height: sizes[size],
            border: '3px solid rgba(102, 126, 234, 0.2)',
            borderTopColor: '#667eea',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
        }} />
    );
};

/**
 * Loading Overlay Component
 */
export const LoadingOverlay: React.FC<{ message?: string }> = ({
    message = 'Loading...'
}) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <LoadingSpinner size="large" />
            <p style={{
                color: 'white',
                marginTop: '20px',
                fontSize: '18px',
                fontWeight: 500
            }}>
                {message}
            </p>
        </div>
    );
};

/**
 * Skeleton Loader Component
 */
export const Skeleton: React.FC<{
    width?: string;
    height?: string;
    borderRadius?: string;
}> = ({
    width = '100%',
    height = '20px',
    borderRadius = '4px'
}) => {
        return (
            <div style={{
                width,
                height,
                borderRadius,
                backgroundColor: '#e0e0e0',
                animation: 'pulse 1.5s ease-in-out infinite'
            }} />
        );
    };

/**
 * Skeleton Row for tables
 */
export const SkeletonRow: React.FC = () => {
    return (
        <div style={{
            display: 'flex',
            gap: '16px',
            padding: '16px',
            borderBottom: '1px solid #f0f0f0'
        }}>
            <Skeleton width="40px" height="40px" borderRadius="50%" />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Skeleton width="60%" height="16px" />
                <Skeleton width="40%" height="14px" />
            </div>
            <Skeleton width="100px" height="32px" borderRadius="6px" />
        </div>
    );
};

// Add CSS animations to global styles
if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
    document.head.appendChild(style);
}
