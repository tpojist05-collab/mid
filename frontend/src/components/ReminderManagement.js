import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { MessageSquare, Send, Clock, Users, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const ReminderManagement = () => {
  const { user, token } = useAuth();
  const [expiringMembers, setExpiringMembers] = useState([]);
  const [reminderHistory, setReminderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDays, setSelectedDays] = useState(7);
  const [bulkSending, setBulkSending] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [reminderTemplate, setReminderTemplate] = useState(null);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    message: '',
    variables: []
  });
  const [showCustomReminderDialog, setShowCustomReminderDialog] = useState(false);
  const [selectedMemberForReminder, setSelectedMemberForReminder] = useState(null);
  const [customReminderMessage, setCustomReminderMessage] = useState('');

  useEffect(() => {
    fetchExpiringMembers();
    fetchReminderHistory();
    if (user && (user.role === 'admin' || user.role === 'manager')) {
      fetchReminderTemplate();
    }
  }, [selectedDays]);

  const fetchExpiringMembers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/reminders/expiring-members?days=${selectedDays}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setExpiringMembers(response.data.expiring_members || []);
    } catch (error) {
      console.error('Error fetching expiring members:', error);
      setError('Failed to load expiring members');
    } finally {
      setLoading(false);
    }
  };

  const fetchReminderHistory = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/reminders/history`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setReminderHistory(response.data || []);
    } catch (error) {
      console.error('Error fetching reminder history:', error);
    }
  };

  const fetchReminderTemplate = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_BACKEND_URL}/api/settings/reminder-template`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setReminderTemplate(response.data);
      setTemplateForm({
        message: response.data.message || '',
        variables: response.data.variables || []
      });
    } catch (error) {
      console.error('Error fetching reminder template:', error);
    }
  };

  const updateReminderTemplate = async () => {
    try {
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/settings/reminder-template`,
        {
          message: templateForm.message,
          variables: templateForm.variables,
          updated_at: new Date().toISOString()
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success('Reminder template updated successfully');
      setShowTemplateEditor(false);
      fetchReminderTemplate();
    } catch (error) {
      console.error('Error updating reminder template:', error);
      toast.error('Failed to update reminder template');
    }
  };

  const sendIndividualReminder = (member) => {
    setSelectedMemberForReminder(member);
    setCustomReminderMessage('');
    setShowCustomReminderDialog(true);
  };

  const sendCustomReminder = async () => {
    if (!selectedMemberForReminder || !customReminderMessage.trim()) {
      toast.error('Please enter a reminder message');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('member_id', selectedMemberForReminder.id);
      formData.append('custom_message', customReminderMessage.trim());
      
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/reminders/send/${selectedMemberForReminder.id}`,
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      
      if (response.data.whatsapp_link) {
        // Open WhatsApp link
        window.open(response.data.whatsapp_link, '_blank');
      }
      
      toast.success(`Custom reminder sent to ${selectedMemberForReminder.name}`);
      setShowCustomReminderDialog(false);
      setSelectedMemberForReminder(null);
      setCustomReminderMessage('');
      fetchReminderHistory();
    } catch (error) {
      console.error('Error sending custom reminder:', error);
      toast.error(`Failed to send reminder to ${selectedMemberForReminder.name}`);
    }
  };

  const sendBulkReminders = async (days) => {
    try {
      setBulkSending(true);
      
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/reminders/send-bulk`,
        { days_before_expiry: days },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const result = response.data;
      toast.success(`Bulk reminders sent! ${result.sent} successful, ${result.failed} failed`);
      
      setShowBulkDialog(false);
      
      // Refresh data
      await fetchExpiringMembers();
      await fetchReminderHistory();
      
    } catch (error) {
      console.error('Error sending bulk reminders:', error);
      toast.error('Failed to send bulk reminders');
    } finally {
      setBulkSending(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getUrgencyColor = (days) => {
    if (days <= 1) return 'bg-red-100 text-red-800 border-red-200';
    if (days <= 3) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (days <= 7) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const getUrgencyText = (days) => {
    if (days <= 0) return 'EXPIRED';
    if (days === 1) return 'TOMORROW';
    if (days <= 3) return 'URGENT';
    if (days <= 7) return 'SOON';
    return 'UPCOMING';
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Reminders</h1>
        <div className="flex gap-3">
          <Select value={selectedDays.toString()} onValueChange={(value) => setSelectedDays(parseInt(value))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Expiring Tomorrow</SelectItem>
              <SelectItem value="3">Expiring in 3 Days</SelectItem>
              <SelectItem value="7">Expiring in 7 Days</SelectItem>
              <SelectItem value="15">Expiring in 15 Days</SelectItem>
              <SelectItem value="30">Expiring in 30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          {user?.role === 'admin' && expiringMembers.length > 0 && (
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Users className="w-4 h-4 mr-2" />
                  Bulk Send
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Bulk WhatsApp Reminders</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-blue-800">
                      Send WhatsApp reminders to all {expiringMembers.length} members expiring in {selectedDays} days.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={() => sendBulkReminders(selectedDays)}
                      disabled={bulkSending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {bulkSending ? 'Sending...' : 'Send to All'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchExpiringMembers} className="mt-2">
            Retry
          </Button>
        </div>
      )}

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className={`grid w-full ${(user?.role === 'admin' || user?.role === 'manager') ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="members" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Expiring Members ({expiringMembers.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Reminder History
          </TabsTrigger>
          {(user?.role === 'admin' || user?.role === 'manager') && (
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Message Templates
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {expiringMembers.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <MessageSquare className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No members expiring in {selectedDays} days</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {expiringMembers.map((member) => {
                const daysLeft = Math.ceil(
                  (new Date(member.membership_end) - new Date()) / (1000 * 60 * 60 * 24)
                );
                
                return (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <h3 className="font-medium text-lg">{member.name}</h3>
                            <p className="text-sm text-gray-600">{member.phone}</p>
                            <p className="text-xs text-gray-500">
                              Expires: {formatDate(member.membership_end)}
                            </p>
                          </div>
                          
                          <Badge className={`${getUrgencyColor(daysLeft)} border`}>
                            {getUrgencyText(daysLeft)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          {member.reminder_sent_today && (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              ✓ Sent Today
                            </Badge>
                          )}
                          
                          <Button
                            onClick={() => sendIndividualReminder(member)}
                            variant={member.reminder_sent_today ? 'outline' : 'default'}
                            size="sm"
                            className={member.reminder_sent_today ? '' : 'bg-green-600 hover:bg-green-700'}
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {member.reminder_sent_today ? 'Send Again' : 'Send WhatsApp'}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          Plan: {member.membership_type?.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-gray-600">
                          {daysLeft > 0 ? `${daysLeft} days left` : 'EXPIRED'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {reminderHistory.length === 0 ? (
            <Card>
              <CardContent className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No reminder history available</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {reminderHistory.slice(0, 20).map((reminder) => (
                <Card key={`${reminder.member_id}-${reminder.sent_at}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{reminder.member_name}</h4>
                        <p className="text-sm text-gray-600">
                          Reminder for {reminder.days_before_expiry} days before expiry
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">
                          {formatDate(reminder.sent_date)}
                        </p>
                        <Badge variant="outline" className="text-green-600">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          WhatsApp Sent
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {(user?.role === 'admin' || user?.role === 'manager') && (
          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  WhatsApp Message Template
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reminderTemplate ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-gray-50 border rounded-lg">
                      <Label className="text-sm font-medium text-gray-700">Current Template:</Label>
                      <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">
                        {reminderTemplate.message}
                      </p>
                      <p className="mt-2 text-xs text-gray-500">
                        Last updated: {formatDate(reminderTemplate.updated_at)}
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => setShowTemplateEditor(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Edit Template
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">No template configured</p>
                    <Button 
                      onClick={() => setShowTemplateEditor(true)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Create Template
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Template Editor Dialog */}
            <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Edit WhatsApp Message Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="template-message">Message Template</Label>
                    <textarea
                      id="template-message"
                      value={templateForm.message}
                      onChange={(e) => setTemplateForm({...templateForm, message: e.target.value})}
                      className="w-full mt-1 p-3 border border-gray-300 rounded-md resize-none"
                      rows={8}
                      placeholder="Enter your WhatsApp message template here..."
                    />
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Available Variables:</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm text-blue-800">
                      <div>• {'{member_name}'} - Member's name</div>
                      <div>• {'{expiry_date}'} - Membership expiry date</div>
                      <div>• {'{days_left}'} - Days until expiry</div>
                      <div>• {'{membership_type}'} - Type of membership</div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowTemplateEditor(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={updateReminderTemplate}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Save Template
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}
      </Tabs>

      {/* Custom Reminder Dialog */}
      <Dialog open={showCustomReminderDialog} onOpenChange={setShowCustomReminderDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Custom Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedMemberForReminder && (
              <div className="p-3 bg-gray-50 border rounded-lg">
                <p className="font-medium">{selectedMemberForReminder.name}</p>
                <p className="text-sm text-gray-600">{selectedMemberForReminder.phone}</p>
              </div>
            )}
            
            <div>
              <Label htmlFor="custom-message">Custom Message</Label>
              <textarea
                id="custom-message"
                value={customReminderMessage}
                onChange={(e) => setCustomReminderMessage(e.target.value)}
                className="w-full mt-1 p-3 border border-gray-300 rounded-md resize-none"
                rows={4}
                placeholder="Enter your custom reminder message..."
              />
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowCustomReminderDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={sendCustomReminder}
                disabled={!customReminderMessage.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Send className="w-4 h-4 mr-2" />
                Send WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReminderManagement;