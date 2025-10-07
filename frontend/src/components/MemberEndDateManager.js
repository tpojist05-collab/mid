import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar, CalendarDays } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const MemberEndDateManager = ({ member, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEndDate, setNewEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newEndDate) {
      toast.error('Please select an end date');
      return;
    }

    try {
      setLoading(true);
      
      const response = await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/members/${member.id}/end-date`,
        { end_date: newEndDate },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      toast.success('Member end date updated successfully');
      setIsOpen(false);
      setNewEndDate('');
      
      // Call onUpdate callback to refresh member data
      if (onUpdate) {
        onUpdate();
      }

    } catch (error) {
      console.error('Error updating end date:', error);
      toast.error(error.response?.data?.detail || 'Failed to update end date');
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get today's date in YYYY-MM-DD format for min date
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get date 2 years from now for max date
  const getMaxDate = () => {
    const twoYearsFromNow = new Date();
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
    return twoYearsFromNow.toISOString().split('T')[0];
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="text-green-600 border-green-200 hover:bg-green-50"
          data-testid={`change-end-date-${member.id}`}
        >
          <CalendarDays className="w-4 h-4 mr-1" />
          Change End Date
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Update Membership End Date
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Member Info */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">{member.name}</h4>
            <div className="text-sm space-y-1 text-slate-600">
              <div>
                <strong>Current End Date:</strong> {formatDate(member.membership_end)}
              </div>
              <div>
                <strong>Membership:</strong> {member.membership_type}
              </div>
              <div>
                <strong>Start Date:</strong> {formatDate(member.join_date)}
              </div>
            </div>
          </div>

          {/* Date Selector */}
          <div className="space-y-2">
            <Label htmlFor="new_end_date">New End Date</Label>
            <Input
              id="new_end_date"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              min={getTodayDate()}
              max={getMaxDate()}
              required
              disabled={loading}
              className="w-full"
            />
            <div className="text-xs text-slate-500">
              You can extend the membership up to 2 years from today
            </div>
          </div>

          {/* Preview */}
          {newEndDate && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                <strong>Preview:</strong>
                <div className="mt-1 space-y-1">
                  <div>• New End Date: {formatDate(newEndDate)}</div>
                  <div>• Membership extension confirmed</div>
                  <div className="text-xs text-green-600 mt-2">
                    ⚠️ This will update the member's membership end date. Use this to extend or modify memberships as needed.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Important Notes */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-sm text-amber-800">
              <strong>📋 Important Notes:</strong>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• This will change when the membership expires</li>
                <li>• Use this to extend memberships or correct dates</li>
                <li>• Member will receive reminders based on new end date</li>
                <li>• Payment records remain unchanged</li>
              </ul>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !newEndDate}
              className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="spinner mr-2"></div>
                  Updating...
                </div>
              ) : (
                'Update End Date'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MemberEndDateManager;