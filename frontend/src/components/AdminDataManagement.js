import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertTriangle, Trash2, Database, Users, CreditCard, FileText } from 'lucide-react';
import { toast } from 'sonner';

const AdminDataManagement = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  // Only show for admin users
  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Access Denied</h3>
          <p className="text-red-600">Only administrators can access data management.</p>
        </div>
      </div>
    );
  }

  const clearMembers = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL MEMBERS permanently. This action cannot be undone. Are you sure?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/clear-all-members`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Successfully cleared ${response.data.deleted_count} members`);
    } catch (error) {
      console.error('Error clearing members:', error);
      toast.error('Failed to clear members');
    } finally {
      setLoading(false);
    }
  };

  const clearPayments = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL PAYMENTS and EARNINGS permanently. This action cannot be undone. Are you sure?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/clear-all-payments`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Successfully cleared ${response.data.deleted_count} payments and earnings`);
    } catch (error) {
      console.error('Error clearing payments:', error);
      toast.error('Failed to clear payments');
    } finally {
      setLoading(false);
    }
  };

  const clearReceipts = async () => {
    if (!window.confirm('⚠️ WARNING: This will delete ALL RECEIPTS permanently. This action cannot be undone. Are you sure?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/clear-all-receipts`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Successfully cleared ${response.data.deleted_count} receipts`);
    } catch (error) {
      console.error('Error clearing receipts:', error);
      toast.error('Failed to clear receipts');
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    if (confirmationText !== 'DELETE_ALL_DATA_PERMANENTLY') {
      toast.error('Please type the exact confirmation phrase');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/admin/clear-all-data`,
        { confirmation: confirmationText },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`All application data cleared! Total deleted: ${response.data.total_deleted} records`);
      setShowClearAllDialog(false);
      setConfirmationText('');
    } catch (error) {
      console.error('Error clearing all data:', error);
      toast.error(error.response?.data?.detail || 'Failed to clear all data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Data Management</h1>
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="w-5 h-5" />
          <span className="text-sm font-medium">DANGER ZONE</span>
        </div>
      </div>

      {/* Warning Notice */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-red-800">Critical Data Management</h3>
            <p className="text-sm text-red-700 mt-1">
              These operations permanently delete data and cannot be undone. Use with extreme caution.
              All actions are logged and will send notifications.
            </p>
          </div>
        </div>
      </div>

      {/* Individual Clear Operations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-700">
              <Users className="w-5 h-5" />
              Clear Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Delete all member records, profiles, and membership data.
            </p>
            <Button
              onClick={clearMembers}
              disabled={loading}
              variant="outline"
              className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Members
            </Button>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700">
              <CreditCard className="w-5 h-5" />
              Clear Payments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Delete all payment records and monthly earnings data.
            </p>
            <Button
              onClick={clearPayments}
              disabled={loading}
              variant="outline"
              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Payments
            </Button>
          </CardContent>
        </Card>

        <Card className="border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-700">
              <FileText className="w-5 h-5" />
              Clear Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Delete all generated receipts and receipt templates.
            </p>
            <Button
              onClick={clearReceipts}
              disabled={loading}
              variant="outline"
              className="w-full border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All Receipts
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Clear All Data - Most Dangerous */}
      <Card className="border-red-500 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <Database className="w-5 h-5" />
            Nuclear Option: Clear ALL Application Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-red-100 border border-red-300 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium">
                ⚠️ EXTREMELY DANGEROUS: This will delete ALL data including members, payments, receipts, earnings, and reminders.
                This action is IRREVERSIBLE and will completely reset the application.
              </p>
            </div>

            <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full bg-red-600 hover:bg-red-700"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  CLEAR ALL APPLICATION DATA
                </Button>
              </DialogTrigger>
              
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-5 h-5" />
                    Confirm Complete Data Deletion
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">
                      This will permanently delete:
                    </p>
                    <ul className="text-xs text-red-700 mt-2 space-y-1">
                      <li>• All members and their profiles</li>
                      <li>• All payment records and earnings</li>
                      <li>• All generated receipts</li>
                      <li>• All reminder logs</li>
                      <li>• All monthly statistics</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmation">
                      Type exactly: <code className="bg-gray-100 px-1 rounded">DELETE_ALL_DATA_PERMANENTLY</code>
                    </Label>
                    <Input
                      id="confirmation"
                      value={confirmationText}
                      onChange={(e) => setConfirmationText(e.target.value)}
                      placeholder="DELETE_ALL_DATA_PERMANENTLY"
                      className="font-mono"
                    />
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowClearAllDialog(false);
                        setConfirmationText('');
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={clearAllData}
                      disabled={loading || confirmationText !== 'DELETE_ALL_DATA_PERMANENTLY'}
                      variant="destructive"
                      className="flex-1"
                    >
                      {loading ? 'Deleting...' : 'DELETE ALL'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDataManagement;