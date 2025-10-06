import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiClient } from '../App';
import { toast } from 'sonner';

const ReminderManagement = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testingReminders, setTestingReminders] = useState(false);

  useEffect(() => {
    fetchReminderHistory();
  }, []);

  const fetchReminderHistory = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/reminders/history');
      setReminders(response.data.reminders);
    } catch (error) {
      console.error('Error fetching reminders:', error);
      toast.error('Failed to load reminder history');
    } finally {
      setLoading(false);
    }
  };

  const sendManualReminder = async (memberId, memberName) => {
    try {
      await apiClient.post(`/reminders/send/${memberId}`);
      toast.success(`Reminder sent to ${memberName}`);
      fetchReminderHistory(); // Refresh history
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  const testReminderService = async () => {
    try {
      setTestingReminders(true);
      await apiClient.post('/reminders/test');
      toast.success('Reminder check completed successfully');
      fetchReminderHistory(); // Refresh history
    } catch (error) {
      console.error('Error testing reminders:', error);
      toast.error('Failed to test reminder service');
    } finally {
      setTestingReminders(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysLabel = (days) => {
    if (days === 1) return '1 day before';
    if (days === 3) return '3 days before';
    if (days === 7) return '7 days before';
    return `${days} days before`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <span className="ml-3 text-slate-600">Loading reminders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Automated Reminders</h2>
        <Button 
          onClick={testReminderService}
          disabled={testingReminders}
          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
        >
          {testingReminders ? (
            <div className="flex items-center">
              <div className="spinner mr-2"></div>
              Testing...
            </div>
          ) : (
            '🔄 Run Reminder Check'
          )}
        </Button>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center">
              <span className="mr-2">📅</span>
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-800">Daily at 9 AM & 6 PM</div>
            <p className="text-xs text-slate-600 mt-1">
              Automatic reminder checks
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center">
              <span className="mr-2">📱</span>
              SMS Service
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Active
              </Badge>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Via Twilio SMS
            </p>
          </CardContent>
        </Card>

        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 flex items-center">
              <span className="mr-2">📊</span>
              Reminders Sent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-slate-800">{reminders.length}</div>
            <p className="text-xs text-slate-600 mt-1">
              Total sent this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reminder Types */}
      <Card className="glass border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">⚙️</span>
            Reminder Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-2xl mb-2">⏰</div>
              <div className="font-semibold text-slate-800">7 Days Before</div>
              <div className="text-sm text-slate-600">Early reminder to plan renewal</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl mb-2">⚠️</div>
              <div className="font-semibold text-slate-800">3 Days Before</div>
              <div className="text-sm text-slate-600">Urgent renewal reminder</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="text-2xl mb-2">🚨</div>
              <div className="font-semibold text-slate-800">1 Day Before</div>
              <div className="text-sm text-slate-600">Final expiry warning</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reminder History */}
      <Card className="glass border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">📋</span>
            Recent Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reminders.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-lg font-medium text-slate-800 mb-2">
                No reminders sent yet
              </h3>
              <p className="text-slate-600 mb-4">
                Reminders will appear here when members' memberships are about to expire.
              </p>
              <Button 
                onClick={testReminderService}
                variant="outline"
                disabled={testingReminders}
              >
                Test Reminder System
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {reminders.slice(0, 10).map((reminder, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-4 bg-white/60 rounded-lg border border-slate-200"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">
                      {reminder.member_name}
                    </div>
                    <div className="text-sm text-slate-600">
                      Reminded {getDaysLabel(reminder.days_before_expiry)} expiry
                    </div>
                    <div className="text-xs text-slate-500">
                      Membership expires: {new Date(reminder.membership_end).toLocaleDateString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-slate-600">
                      {formatDate(reminder.sent_at)}
                    </div>
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      Sent
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Reminder Section */}
      <Card className="glass border-0 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">📤</span>
            Send Manual Reminder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600 mb-4">
            Need to send a reminder outside the automatic schedule? Use the member management section to send individual reminders.
          </p>
          <div className="text-sm text-slate-500">
            💡 <strong>Tip:</strong> Go to Members → Select a member → Click "Send Reminder" to send individual notifications.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReminderManagement;