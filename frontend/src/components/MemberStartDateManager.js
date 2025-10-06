import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar, CalendarDays } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const MemberStartDateManager = ({ member, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newStartDate, setNewStartDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newStartDate) {
      toast.error('Please select a start date');
      return;
    }

    try {
      setLoading(true);
      
      const response = await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/members/${member.id}/start-date`,
        { start_date: newStartDate },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      toast.success('Member start date updated successfully');
      setIsOpen(false);
      setNewStartDate('');
      
      // Call onUpdate callback to refresh member data
      if (onUpdate) {
        onUpdate();
      }

    } catch (error) {
      console.error('Error updating start date:', error);
      toast.error(error.response?.data?.detail || 'Failed to update start date');
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

  // Get today's date in YYYY-MM-DD format for max date
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get date 2 years ago for min date (reasonable backdate limit)
  const getMinDate = () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return twoYearsAgo.toISOString().split('T')[0];
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="text-blue-600 border-blue-200 hover:bg-blue-50"
          data-testid={`change-start-date-${member.id}`}
        >
          <CalendarDays className="w-4 h-4 mr-1" />
          Change Start Date
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Update Member Start Date
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Member Info */}
          <div className="p-4 bg-slate-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">{member.name}</h4>
            <div className="text-sm space-y-1 text-slate-600">
              <div>
                <strong>Current Start Date:</strong> {formatDate(member.join_date)}
              </div>
              <div>
                <strong>Membership:</strong> {member.membership_type}
              </div>
              <div>
                <strong>Current End Date:</strong> {formatDate(member.membership_end)}
              </div>
            </div>
          </div>

          {/* Date Selector */}
          <div className="space-y-2">
            <Label htmlFor="new_start_date">New Start Date</Label>
            <Input
              id="new_start_date"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              min={getMinDate()}
              max={getTodayDate()}
              required
              disabled={loading}
              className="w-full"
            />
            <div className="text-xs text-slate-500">
              You can select any date up to 2 years ago or up to today
            </div>
          </div>

          {/* Preview */}
          {newStartDate && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Preview:</strong>
                <div className="mt-1 space-y-1">
                  <div>• New Start Date: {formatDate(newStartDate)}</div>
                  <div>• Membership will be recalculated from this date</div>
                  <div className="text-xs text-blue-600 mt-2">
                    ⚠️ This will update the member's gym start date and recalculate their membership end date accordingly.
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
                <li>• This will change the member's gym joining date</li>
                <li>• Membership end date will be recalculated automatically</li>
                <li>• Useful for correcting initial enrollment dates</li>
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
              disabled={loading || !newStartDate}
              className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="spinner mr-2"></div>
                  Updating...
                </div>
              ) : (
                'Update Start Date'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MemberStartDateManager;