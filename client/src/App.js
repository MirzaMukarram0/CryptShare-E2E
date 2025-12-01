import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoadingSpinner } from './components/common';
import './theme.css';
import './App.css';

// Lazy load components for code splitting
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const Chat = lazy(() => import('./components/Chat'));

// Loading fallback component
const PageLoader = () => (
  <LoadingSpinner 
    fullScreen 
    size="large" 
    text="Loading CryptShare..." 
  />
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in (token in localStorage)
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (e) {
        // Invalid user data, clear storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Memoized callbacks to prevent unnecessary re-renders
  const handleLogin = useCallback((userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('signingKey');
    sessionStorage.removeItem('keyExchangeKey');
    setUser(null);
  }, []);

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Router>
      <div className="app">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route 
              path="/login" 
              element={user ? <Navigate to="/chat" replace /> : <Login onLogin={handleLogin} />} 
            />
            <Route 
              path="/register" 
              element={user ? <Navigate to="/chat" replace /> : <Register onLogin={handleLogin} />} 
            />
            <Route 
              path="/chat" 
              element={user ? <Chat user={user} onLogout={handleLogout} /> : <Navigate to="/login" replace />} 
            />
            <Route path="*" element={<Navigate to={user ? "/chat" : "/login"} replace />} />
          </Routes>
        </Suspense>
      </div>
    </Router>
  );
}

export default App;
