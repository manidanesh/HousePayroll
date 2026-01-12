import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ipcAPI } from './lib/ipc';
import PinSetup from './components/PinSetup';
import PinLogin from './components/PinLogin';
import OnboardingWizard from './components/OnboardingWizard';
import Dashboard from './components/Dashboard';

import { CaregiverProvider, useCaregiver } from './context/caregiver-context';
import CaregiverSelectionScreen from './components/CaregiverSelectionScreen';

const Main: React.FC = () => {
    const [isPinSet, setIsPinSet] = useState<boolean>(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [hasEmployerProfile, setHasEmployerProfile] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const { selectedCaregiver, setIsSelectionRequired, isSelectionRequired } = useCaregiver();

    useEffect(() => {
        checkAppStatus();
    }, []);

    useEffect(() => {
        if (!isAuthenticated) return;

        let logoutTimer: any;
        const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes

        const resetTimer = () => {
            if (logoutTimer) clearTimeout(logoutTimer);
            logoutTimer = setTimeout(() => {
                setIsAuthenticated(false);
            }, INACTIVITY_LIMIT);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, resetTimer));

        resetTimer();

        return () => {
            if (logoutTimer) clearTimeout(logoutTimer);
            events.forEach(event => window.removeEventListener(event, resetTimer));
        };
    }, [isAuthenticated]);

    const checkAppStatus = async () => {
        try {
            const pinSet = await ipcAPI.auth.isPinSet();
            const employerExists = await ipcAPI.employer.has();

            setIsPinSet(pinSet);
            setHasEmployerProfile(employerExists);
        } catch (error) {
            toast.error('Failed to check app status');
        } finally {
            setLoading(false);
        }
    };

    const handlePinSetup = () => {
        setIsPinSet(true);
        setIsAuthenticated(true);
    };

    const handleLogin = async () => {
        setIsAuthenticated(true);

        try {
            // Check if employer profile exists after login
            const employerExists = await ipcAPI.employer.has();
            setHasEmployerProfile(employerExists);

            if (employerExists) {
                const caregivers = await ipcAPI.caregiver.getAll(false);
                if (caregivers.length > 1) {
                    setIsSelectionRequired(true);
                }
            }
        } catch (error) {
            toast.error('Failed to check employer profile');
        }
    };

    const handleEmployerSetup = () => {
        setHasEmployerProfile(true);
        setIsSelectionRequired(false); // New setup usually only has one
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <h2>Loading...</h2>
            </div>
        );
    }

    // Step 1: Set up PIN if not configured
    if (!isPinSet) {
        return <PinSetup onPinSetup={handlePinSetup} />;
    }

    // Step 2: Authenticate with PIN
    if (!isAuthenticated) {
        return <PinLogin onLogin={handleLogin} />;
    }

    // Step 3: Set up employer profile and first caregiver if not configured
    if (!hasEmployerProfile) {
        return <OnboardingWizard onComplete={handleEmployerSetup} />;
    }

    // Step 4: Core selection (if multiple caregivers)
    if (isSelectionRequired && !selectedCaregiver) {
        return <CaregiverSelectionScreen onSelect={() => setIsSelectionRequired(false)} />;
    }

    // Step 5: Show main dashboard
    return <Dashboard />;
};

const App: React.FC = () => {
    return (
        <CaregiverProvider>
            <Main />
        </CaregiverProvider>
    );
};

export default App;
