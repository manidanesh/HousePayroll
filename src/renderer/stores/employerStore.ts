import { create } from 'zustand';
import { ipcAPI } from '../lib/ipc';
import { Employer } from '../../types';
import toast from 'react-hot-toast';

interface EmployerState {
    employer: Employer | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchEmployer: () => Promise<void>;
    updateEmployer: (data: Partial<Employer>) => Promise<void>;
    setEmployer: (employer: Employer | null) => void;
    clearError: () => void;
}

/**
 * Zustand store for employer state management
 * 
 * Provides centralized state for employer data with built-in
 * loading states, error handling, and toast notifications.
 * 
 * @example
 * const { employer, loading, fetchEmployer, updateEmployer } = useEmployerStore();
 * 
 * useEffect(() => {
 *   fetchEmployer();
 * }, []);
 */
export const useEmployerStore = create<EmployerState>((set, get) => ({
    employer: null,
    loading: false,
    error: null,

    fetchEmployer: async () => {
        set({ loading: true, error: null });
        try {
            const employer = await ipcAPI.employer.get();
            set({ employer, loading: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load employer';
            set({ error: message, loading: false });
            toast.error(message);
        }
    },

    updateEmployer: async (data: Partial<Employer>) => {
        set({ loading: true, error: null });
        try {
            const updated = await ipcAPI.employer.update(data);
            set({ employer: updated, loading: false });
            toast.success('Employer settings updated successfully');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update employer';
            set({ error: message, loading: false });
            toast.error(message);
            throw error; // Re-throw so caller can handle if needed
        }
    },

    setEmployer: (employer) => {
        set({ employer });
    },

    clearError: () => {
        set({ error: null });
    }
}));
