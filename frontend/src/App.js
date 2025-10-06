import React, { useState, useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import Dashboard from "./components/Dashboard";
import MemberManagement from "./components/MemberManagement";
import PaymentManagement from "./components/PaymentManagement";
import ReminderManagement from "./components/ReminderManagement";
import Navigation from "./components/Navigation";
import { Toaster } from "./components/ui/sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL: API,
  headers: {
    'Content-Type': 'application/json',
  },
});

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  const renderCurrentPage = () => {
    switch(currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'members':
        return <MemberManagement />;
      case 'payments':
        return <PaymentManagement />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <header className="mb-8">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-slate-800 mb-2">
              💪 FitTrack Gym Management
            </h1>
            <p className="text-slate-600 text-lg">
              Complete membership tracking and management system
            </p>
          </div>
          
          <Navigation 
            currentPage={currentPage} 
            setCurrentPage={setCurrentPage} 
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
}

export default App;
