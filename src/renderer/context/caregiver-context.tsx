import React, { createContext, useContext, useState, useEffect } from 'react';
import { ipcAPI } from '../lib/ipc';

interface Caregiver {
    id: number;
    fullLegalName: string;
}

interface CaregiverContextType {
    selectedCaregiver: Caregiver | null;
    setSelectedCaregiver: (caregiver: Caregiver | null) => void;
    selectCaregiver: (caregiver: Caregiver) => void;
    clearSelection: () => void;
    isSelectionRequired: boolean;
    setIsSelectionRequired: (required: boolean) => void;
}

const CaregiverContext = createContext<CaregiverContextType | undefined>(undefined);

export const CaregiverProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
    const [isSelectionRequired, setIsSelectionRequired] = useState<boolean>(false);

    const clearSelection = () => {
        setSelectedCaregiver(null);
        setIsSelectionRequired(true);
    };

    const selectCaregiver = (caregiver: Caregiver) => {
        setSelectedCaregiver(caregiver);
        setIsSelectionRequired(false);
    };

    return (
        <CaregiverContext.Provider value={{
            selectedCaregiver,
            setSelectedCaregiver,
            selectCaregiver,
            clearSelection,
            isSelectionRequired,
            setIsSelectionRequired
        }}>
            {children}
        </CaregiverContext.Provider>
    );
};

export const useCaregiver = () => {
    const context = useContext(CaregiverContext);
    if (!context) {
        throw new Error('useCaregiver must be used within a CaregiverProvider');
    }
    return context;
};
