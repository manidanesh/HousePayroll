import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/auth-service';
import { EmployerService } from '../services/employer-service';
import PinSetup from './components/PinSetup';
import PinLogin from './components/PinLogin';
import EmployerSetup from './components/EmployerSetup';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
    const [isPinSet, setIsPinSet] = useState<boolean>(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [hasEmployerProfile, setHasEmployerProfile] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        checkAppStatus();
    }, []);

    const checkAppStatus = () => {
        const pinSet = AuthService.isPinSet();
        const employerExists = EmployerService.hasEmployerProfile();

        setIsPinSet(pinSet);
        setHasEmployerProfile(employerExists);
        setLoading(false);
    };

    const handlePinSetup = () => {
        setIsPinSet(true);
        setIsAuthenticated(true);
    };

    const handleLogin = () => {
        setIsAuthenticated(true);

        // Check if employer profile exists after login
        const employerExists = EmployerService.hasEmployerProfile();
        setHasEmployerProfile(employerExists);
    };

    const handleEmployerSetup = () => {
        setHasEmployerProfile(true);
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

    // Step 3: Set up employer profile if not configured
    if (!hasEmployerProfile) {
        return <EmployerSetup onComplete={handleEmployerSetup} />;
    }

    // Step 4: Show main dashboard
    return <Dashboard />;
};

export default App;
