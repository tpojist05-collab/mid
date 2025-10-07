import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiClient } from '../App';
import { toast } from 'sonner';

const Dashboard = ({ setCurrentPage }) => {
  const [stats, setStats] = useState(null);
  const [expiringMembers, setExpiringMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch stats (required)
      const statsRes = await apiClient.get('/dashboard/stats');
      setStats(statsRes.data);
      
      // Fetch expiring members (optional, handle errors gracefully)
      try {
        const expiringRes = await apiClient.get('/members/expiring-soon?days=7');
        setExpiringMembers(expiringRes.data);
      } catch (expiringError) {
        console.warn('Could not load expiring members:', expiringError);
        setExpiringMembers([]);
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <span className="ml-3 text-slate-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="card-hover glass border-0 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-300 hover:scale-105"
          onClick={() => setCurrentPage('members')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              Total Members
            </CardTitle>
            <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">👥</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600" data-testid="total-members">
              {stats?.total_members || 0}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              All registered members
            </p>
            <p className="text-xs text-blue-600 mt-1 font-medium">Click to view all members →</p>
          </CardContent>
        </Card>

        <Card className="card-hover glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              Active Members
            </CardTitle>
            <div className="h-8 w-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">✅</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="active-members">
              {stats?.active_members || 0}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Currently paid up
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              Pending Payments
            </CardTitle>
            <div className="h-8 w-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">⏳</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600" data-testid="pending-members">
              {stats?.pending_members || 0}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Awaiting payment
            </p>
          </CardContent>
        </Card>

        <Card className="card-hover glass border-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">
              Monthly Revenue
            </CardTitle>
            <div className="h-8 w-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">💰</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600" data-testid="monthly-revenue">
              {formatCurrency(stats?.monthly_revenue || 0)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              This month's earnings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Expiring Memberships Alert */}
      {expiringMembers.length > 0 && (
        <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50">
          <CardHeader>
            <CardTitle className="text-orange-800 flex items-center">
              <span className="mr-2 text-2xl">⚠️</span>
              Memberships Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-700 mb-4">
              {expiringMembers.length} member(s) have memberships expiring in the next 7 days
            </p>
            <div className="space-y-3">
              {expiringMembers.slice(0, 5).map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between bg-white/60 rounded-lg p-3 border border-orange-200"
                  data-testid={`expiring-member-${member.id}`}
                >
                  <div>
                    <div className="font-medium text-slate-800">{member.name}</div>
                    <div className="text-sm text-slate-600">{member.phone}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                      Expires: {formatDate(member.membership_end)}
                    </Badge>
                    <div className="text-sm text-slate-600 mt-1">
                      {member.membership_type.charAt(0).toUpperCase() + member.membership_type.slice(1)} Plan
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {expiringMembers.length > 5 && (
              <p className="text-sm text-orange-600 mt-3 text-center">
                ...and {expiringMembers.length - 5} more
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="glass border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2 text-xl">⚡</span>
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              className="btn-animate bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-6 rounded-xl"
              data-testid="add-member-btn"
              onClick={() => {
                // Navigate to members page and trigger add modal
                if (setCurrentPage) {
                  setCurrentPage('members');
                  setTimeout(() => {
                    const event = new CustomEvent('openAddMemberModal');
                    window.dispatchEvent(event);
                  }, 100);
                }
              }}
            >
              <div className="text-center">
                <div className="text-2xl mb-2">👤</div>
                <div className="font-semibold">Add New Member</div>
                <div className="text-sm opacity-90">Register a new gym member</div>
              </div>
            </Button>
            
            <Button 
              className="btn-animate bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-6 rounded-xl"
              data-testid="record-payment-btn"
              onClick={() => {
                // Navigate to payments page and trigger add modal
                if (setCurrentPage) {
                  setCurrentPage('payments');
                  setTimeout(() => {
                    const event = new CustomEvent('openPaymentModal');
                    window.dispatchEvent(event);
                  }, 100);
                }
              }}
            >
              <div className="text-center">
                <div className="text-2xl mb-2">💳</div>
                <div className="font-semibold">Record Payment</div>
                <div className="text-sm opacity-90">Log a member payment</div>
              </div>
            </Button>
            
            <Button 
              className="btn-animate bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-6 rounded-xl"
              data-testid="send-reminders-btn"
              onClick={() => {
                // Navigate to reminders page
                if (setCurrentPage) {
                  setCurrentPage('reminders');
                } else {
                  toast.info('Reminder system available in Reminders tab!');
                }
              }}
            >
              <div className="text-center">
                <div className="text-2xl mb-2">📱</div>
                <div className="font-semibold">Send Reminders</div>
                <div className="text-sm opacity-90">WhatsApp/SMS notifications</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;