import { create } from 'zustand';
import { ipcAPI } from '../lib/ipc';
import { Caregiver, CreateCaregiverInput, UpdateCaregiverInput } from '../../types';
import toast from 'react-hot-toast';

interface CaregiverState {
    caregivers: Caregiver[];
    selectedCaregiver: Caregiver | null;
    loading: boolean;
    error: string | null;

    // Actions
    fetchCaregivers: (includeInactive?: boolean) => Promise<void>;
    createCaregiver: (data: CreateCaregiverInput) => Promise<Caregiver>;
    updateCaregiver: (id: number, data: UpdateCaregiverInput) => Promise<void>;
    deleteCaregiver: (id: number) => Promise<void>;
    selectCaregiver: (caregiver: Caregiver | null) => void;
    clearError: () => void;
}

/**
 * Zustand store for caregiver state management
 * 
 * @example
 * const { caregivers, loading, fetchCaregivers, createCaregiver } = useCaregiverStore();
 */
export const useCaregiverStore = create<CaregiverState>((set, get) => ({
    caregivers: [],
    selectedCaregiver: null,
    loading: false,
    error: null,

    fetchCaregivers: async (includeInactive = false) => {
        set({ loading: true, error: null });
        try {
            const caregivers = await ipcAPI.caregiver.getAll(includeInactive);
            set({ caregivers, loading: false });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load caregivers';
            set({ error: message, loading: false });
            toast.error(message);
        }
    },

    createCaregiver: async (data: CreateCaregiverInput) => {
        set({ loading: true, error: null });
        try {
            const caregiver = await ipcAPI.caregiver.create(data);
            set((state) => ({
                caregivers: [...state.caregivers, caregiver],
                loading: false
            }));
            toast.success(`Caregiver ${caregiver.fullLegalName} created successfully`);
            return caregiver;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create caregiver';
            set({ error: message, loading: false });
            toast.error(message);
            throw error;
        }
    },

    updateCaregiver: async (id: number, data: UpdateCaregiverInput) => {
        set({ loading: true, error: null });
        try {
            const updated = await ipcAPI.caregiver.update(id, data);
            set((state) => ({
                caregivers: state.caregivers.map(c => c.id === id ? updated : c),
                selectedCaregiver: state.selectedCaregiver?.id === id ? updated : state.selectedCaregiver,
                loading: false
            }));
            toast.success('Caregiver updated successfully');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update caregiver';
            set({ error: message, loading: false });
            toast.error(message);
            throw error;
        }
    },

    deleteCaregiver: async (id: number) => {
        set({ loading: true, error: null });
        try {
            await ipcAPI.caregiver.delete(id);
            set((state) => ({
                caregivers: state.caregivers.filter(c => c.id !== id),
                selectedCaregiver: state.selectedCaregiver?.id === id ? null : state.selectedCaregiver,
                loading: false
            }));
            toast.success('Caregiver deleted successfully');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete caregiver';
            set({ error: message, loading: false });
            toast.error(message);
            throw error;
        }
    },

    selectCaregiver: (caregiver) => {
        set({ selectedCaregiver: caregiver });
    },

    clearError: () => {
        set({ error: null });
    }
}));
