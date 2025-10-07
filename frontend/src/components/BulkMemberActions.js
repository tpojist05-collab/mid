import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Checkbox } from './ui/checkbox';
import { Trash2, Users, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const BulkMemberActions = ({ members, onUpdate, userRole }) => {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Only show for admin users
  if (userRole !== 'admin') {
    return null;
  }

  const handleSelectMember = (memberId, isSelected) => {
    if (isSelected) {
      setSelectedMembers(prev => [...prev, memberId]);
    } else {
      setSelectedMembers(prev => prev.filter(id => id !== memberId));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedMembers(members.map(member => member.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMembers.length === 0) {
      toast.error('No members selected');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/members/bulk-delete`,
        { member_ids: selectedMembers },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      toast.success(`Successfully deleted ${response.data.deleted_count} members`);
      setIsDeleteDialogOpen(false);
      setSelectedMembers([]);

      // Call onUpdate callback to refresh member data
      if (onUpdate) {
        onUpdate();
      }

    } catch (error) {
      console.error('Error deleting members:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete members');
    } finally {
      setLoading(false);
    }
  };

  const getSelectedMemberNames = () => {
    return members
      .filter(member => selectedMembers.includes(member.id))
      .map(member => member.name);
  };

  return (
    <>
      {/* Bulk Actions Trigger Button */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            className="text-red-600 border-red-200 hover:bg-red-50"
            disabled={members.length === 0}
          >
            <Users className="w-4 h-4 mr-2" />
            Bulk Actions
          </Button>
        </DialogTrigger>

        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Bulk Delete Members
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Warning */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Danger Zone</h4>
                  <p className="text-sm text-red-700 mt-1">
                    This action will permanently delete selected members and cannot be undone. 
                    All associated payment records and history will be preserved.
                  </p>
                </div>
              </div>
            </div>

            {/* Select All */}
            <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
              <Checkbox
                id="select-all"
                checked={selectedMembers.length === members.length && members.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <Label 
                htmlFor="select-all" 
                className="text-sm font-medium cursor-pointer"
              >
                Select All ({members.length} members)
              </Label>
            </div>

            {/* Member List */}
            <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
              {members.map(member => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                >
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`member-${member.id}`}
                      checked={selectedMembers.includes(member.id)}
                      onCheckedChange={(checked) => handleSelectMember(member.id, checked)}
                    />
                    <div>
                      <p className="font-medium text-sm">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {member.membership_type?.replace('_', ' ').toUpperCase()}
                  </div>
                </div>
              ))}

              {members.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  No members available
                </div>
              )}
            </div>

            {/* Selection Summary */}
            {selectedMembers.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">
                  Selected for Deletion ({selectedMembers.length})
                </h4>
                <div className="text-sm text-blue-700">
                  {getSelectedMemberNames().slice(0, 3).map((name, index) => (
                    <span key={index}>
                      {name}{index < Math.min(2, getSelectedMemberNames().length - 1) ? ', ' : ''}
                    </span>
                  ))}
                  {getSelectedMemberNames().length > 3 && (
                    <span> and {getSelectedMemberNames().length - 3} more...</span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setSelectedMembers([]);
                }}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkDelete}
                disabled={loading || selectedMembers.length === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="spinner mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  `Delete ${selectedMembers.length} Member${selectedMembers.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default BulkMemberActions;