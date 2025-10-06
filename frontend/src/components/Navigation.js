import React from 'react';
import { Button } from './ui/button';

const Navigation = ({ currentPage, setCurrentPage, isAdmin }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'members', label: 'Members', icon: '👥' },
    { id: 'payments', label: 'Payments', icon: '💳' },
    { id: 'reminders', label: 'Reminders', icon: '📱' }
  ];

  // Add settings for admin users
  if (isAdmin) {
    navItems.push({ id: 'settings', label: 'Settings', icon: '⚙️' });
  }

  return (
    <nav className="flex justify-center mb-8">
      <div className="bg-white/60 backdrop-blur-lg rounded-2xl p-2 shadow-lg border border-white/20">
        <div className="flex gap-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              variant={currentPage === item.id ? "default" : "ghost"}
              className={`px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
                currentPage === item.id
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg transform scale-105'
                  : 'hover:bg-white/50 text-slate-700'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <span className="mr-2 text-lg">{item.icon}</span>
              {item.label}
            </Button>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;