import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/auth-service';
import PinSetup from './components/PinSetup';
import PinLogin from './components/PinLogin';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
    const [isPinSet, setIsPinSet] = useState<boolean>(false);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        checkPinStatus();
    }, []);

    const checkPinStatus = () => {
        const pinSet = AuthService.isPinSet();
        setIsPinSet(pinSet);
        setLoading(false);
    };

    const handlePinSetup = () => {
        setIsPinSet(true);
        setIsAuthenticated(true);
    };

    const handleLogin = () => {
        setIsAuthenticated(true);
    };

    if (loading) {
        return (
            <div className="loading-screen">
                <h2>Loading...</h2>
            </div>
        );
    }

    if (!isPinSet) {
        return <PinSetup onPinSetup={handlePinSetup} />;
    }

    if (!isAuthenticated) {
        return <PinLogin onLogin={handleLogin} />;
    }

    return <Dashboard />;
};

export default App;
