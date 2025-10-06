import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import Dashboard from "./components/Dashboard";
import MemberManagement from "./components/MemberManagement";
import PaymentManagement from "./components/PaymentManagement";
import ReminderManagement from "./components/ReminderManagement";
import SettingsManagement from "./components/SettingsManagement";
import LoginForm from "./components/LoginForm";
import Navigation from "./components/Navigation";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Button } from "./components/ui/button";
import { Badge } from "./components/ui/badge";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

const AppContent = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const { user, loading, logout, isAdmin } = useAuth();

  const renderCurrentPage = () => {
    switch(currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <MemberManagement />;
      case 'payments':
        return <PaymentManagement />;
      case 'reminders':
        return <ReminderManagement />;
      case 'settings':
        return <SettingsManagement />;
      default:
        return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">💪</div>
          <div className="spinner mb-4"></div>
          <p className="text-slate-600">Loading Iron Paradise Gym...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div className="text-center flex-1">
              <h1 className="text-4xl font-bold text-slate-800 mb-2">
                💪 Iron Paradise Gym
              </h1>
              <p className="text-slate-600 text-lg">
                Complete membership tracking and management system
              </p>
            </div>
            
            {/* User Info & Logout */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-medium text-slate-800">{user.full_name}</div>
                <div className="flex items-center gap-2">
                  <Badge className={user.role === 'admin' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200'}>
                    {user.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                  </Badge>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="text-red-600 border-red-200 hover:bg-red-50"
                data-testid="logout-btn"
              >
                🚪 Logout
              </Button>
            </div>
          </div>
          
          <Navigation 
            currentPage={currentPage} 
            setCurrentPage={setCurrentPage}
            isAdmin={isAdmin()}
          />
        </header>

        {/* Main Content */}
        <main>
          {renderCurrentPage()}
        </main>
      </div>
      
      <Toaster position="top-right" />
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
