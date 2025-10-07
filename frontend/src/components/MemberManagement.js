import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { apiClient } from '../App';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import MemberForm from './forms/MemberForm';
import MemberStartDateManager from './MemberStartDateManager';
import MemberEndDateManager from './MemberEndDateManager';
import BulkMemberActions from './BulkMemberActions';

const MemberManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all', 'active', 'inactive'
  const { user, isAdmin } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    emergency_contact: {
      name: '',
      phone: '',
      relationship: ''
    },
    membership_type: 'monthly'
  });

  useEffect(() => {
    fetchMembers();
    
    // Listen for custom events from dashboard
    const handleAddMember = () => setIsAddModalOpen(true);
    window.addEventListener('openAddMemberModal', handleAddMember);
    
    return () => {
      window.removeEventListener('openAddMemberModal', handleAddMember);
    };
  }, []);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/members');
      setMembers(response.data);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedMember) {
        await apiClient.put(`/members/${selectedMember.id}`, formData);
        toast.success('Member updated successfully');
        setIsEditModalOpen(false);
      } else {
        await apiClient.post('/members', formData);
        toast.success('Member added successfully');
        setIsAddModalOpen(false);
      }
      
      fetchMembers();
      resetForm();
    } catch (error) {
      console.error('Error saving member:', error);
      toast.error(selectedMember ? 'Failed to update member' : 'Failed to add member');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      emergency_contact: {
        name: '',
        phone: '',
        relationship: ''
      },
      membership_type: 'monthly'
    });
    setSelectedMember(null);
  };

  const handleEdit = (member) => {
    setSelectedMember(member);
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone,
      address: member.address,
      emergency_contact: member.emergency_contact,
      membership_type: member.membership_type
    });
    setIsEditModalOpen(true);
  };

  const sendReminderToMember = async (member) => {
    try {
      await apiClient.post(`/reminders/send/${member.id}`);
      toast.success(`Reminder sent to ${member.name}`);
    } catch (error) {
      console.error('Error sending reminder:', error);
      toast.error('Failed to send reminder');
    }
  };

  const deleteMember = async (member) => {
    if (!isAdmin()) {
      toast.error('Only administrators can delete members');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${member.name}? This action cannot be undone and will remove all associated data.`)) {
      return;
    }

    try {
      await apiClient.delete(`/members/${member.id}`);
      toast.success(`Member ${member.name} deleted successfully`);
      fetchMembers();
    } catch (error) {
      console.error('Error deleting member:', error);
      toast.error('Failed to delete member');
    }
  };

  const updateMemberStatus = async (member, newStatus) => {
    try {
      await apiClient.patch(`/members/${member.id}/status?status=${newStatus}`);
      toast.success(`Member status updated to ${newStatus}`);
      fetchMembers();
    } catch (error) {
      console.error('Error updating member status:', error);
      toast.error('Failed to update member status');
    }
  };

  const getMembershipLabel = (type) => {
    const labels = {
      monthly: 'Monthly',
      quarterly: 'Quarterly (3 months)',
      six_monthly: 'Six Monthly (6 months)'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (member) => {
    const isExpired = new Date(member.membership_end) < new Date();
    const isExpiringSoon = new Date(member.membership_end) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    // Check member status first
    if (member.member_status === 'suspended') {
      return <Badge className="bg-red-100 text-red-800 border-red-200">Suspended</Badge>;
    } else if (member.member_status === 'frozen') {
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Frozen</Badge>;
    } else if (member.member_status === 'inactive') {
      return <Badge className="bg-gray-100 text-gray-800 border-gray-200">Inactive</Badge>;
    }
    
    // Then check payment and expiry status
    if (member.current_payment_status === 'paid' && !isExpired) {
      return <Badge className="status-paid">Active</Badge>;
    } else if (member.current_payment_status === 'pending') {
      return <Badge className="status-pending">Pending</Badge>;
    } else if (isExpired) {
      return <Badge className="status-overdue">Expired</Badge>;
    } else if (isExpiringSoon) {
      return <Badge variant="outline" className="border-orange-300 text-orange-600">Expiring Soon</Badge>;
    }
    return <Badge variant="secondary">Unknown</Badge>;
  };

  const getStatusActions = (member) => {
    return (
      <div className="flex flex-wrap gap-1">
        {member.member_status !== 'active' && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => updateMemberStatus(member, 'active')}
            className="text-green-600 border-green-200 hover:bg-green-50"
          >
            Activate
          </Button>
        )}
        {member.member_status !== 'suspended' && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => updateMemberStatus(member, 'suspended')}
            className="text-red-600 border-red-200 hover:bg-red-50"
          >
            Suspend
          </Button>
        )}
        {member.member_status !== 'frozen' && (
          <Button
            size="xs"
            variant="outline"
            onClick={() => updateMemberStatus(member, 'frozen')}
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            Freeze
          </Button>
        )}
      </div>
    );
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

  // Filter members based on search, status, and view mode
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.phone.includes(searchTerm);
    
    if (!matchesSearch) return false;

    // Filter by view mode first
    const isExpired = new Date(member.membership_end) < new Date();
    const isActiveStatus = member.current_payment_status === 'active' || member.current_payment_status === 'paid';
    
    switch (viewMode) {
      case 'active':
        if (!isActiveStatus || isExpired) return false;
        break;
      case 'expired':
        if (member.current_payment_status !== 'expired') return false;
        break;
      case 'expiring_7days':
        if (!member.membership_end) return false;
        const endDate7 = new Date(member.membership_end);
        const now7 = new Date();
        const diffDays7 = Math.ceil((endDate7 - now7) / (1000 * 60 * 60 * 24));
        if (!(diffDays7 > 0 && diffDays7 <= 7)) return false;
        break;
      case 'expiring_30days':
        if (!member.membership_end) return false;
        const endDate30 = new Date(member.membership_end);
        const now30 = new Date();
        const diffDays30 = Math.ceil((endDate30 - now30) / (1000 * 60 * 60 * 24));
        if (!(diffDays30 > 0 && diffDays30 <= 30)) return false;
        break;
      case 'inactive':
        if (!(member.current_payment_status === 'inactive' || member.current_payment_status === 'suspended')) return false;
        break;
      case 'all':
      default:
        // Show all members
        break;
    }
    
    // Then filter by status filter
    if (statusFilter === 'all') return true;
    
    switch (statusFilter) {
      case 'active':
        return member.member_status === 'active' && member.current_payment_status === 'paid' && !isExpired;
      case 'suspended':
        return member.member_status === 'suspended';
      case 'frozen':
        return member.member_status === 'frozen';
      case 'inactive':
        return member.member_status === 'inactive';
      case 'pending':
        return member.current_payment_status === 'pending';
      case 'expired':
        return isExpired;
      default:
        return true;
    }
  });

  // MemberForm component moved to separate file to prevent re-creation and focus loss

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <span className="ml-3 text-slate-600">Loading members...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Member Management</h2>
        <div className="flex gap-3">
          <BulkMemberActions 
            members={filteredMembers} 
            onUpdate={fetchMembers}
            userRole={user?.role}
          />
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" data-testid="add-member-btn">
                Add New Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-50">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <MemberForm 
                formData={formData}
                setFormData={setFormData}
                handleSubmit={handleSubmit}
                selectedMember={selectedMember}
                isEditModalOpen={isEditModalOpen}
                setIsEditModalOpen={setIsEditModalOpen}
                isAddModalOpen={isAddModalOpen}
                setIsAddModalOpen={setIsAddModalOpen}
                resetForm={resetForm}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* View Mode Tabs */}
      <Card className="glass border-0">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant={viewMode === 'all' ? 'default' : 'outline'}
              onClick={() => setViewMode('all')}
              className={viewMode === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : ''}
              data-filter="all"
            >
              All ({members.length})
            </Button>
            <Button
              variant={viewMode === 'active' ? 'default' : 'outline'}
              onClick={() => setViewMode('active')}
              className={viewMode === 'active' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''}
              data-filter="active"
            >
              Active ({members.filter(m => m.current_payment_status === 'active' || m.current_payment_status === 'paid').length})
            </Button>
            <Button
              variant={viewMode === 'expired' ? 'default' : 'outline'}
              onClick={() => setViewMode('expired')}
              className={viewMode === 'expired' ? 'bg-gradient-to-r from-red-600 to-rose-600' : ''}
            >
              Expired ({members.filter(m => m.current_payment_status === 'expired').length})
            </Button>
            <Button
              variant={viewMode === 'expiring_7days' ? 'default' : 'outline'}
              onClick={() => setViewMode('expiring_7days')}
              className={viewMode === 'expiring_7days' ? 'bg-gradient-to-r from-orange-600 to-amber-600' : ''}
            >
              Expiring (7 days) ({members.filter(m => {
                if (!m.membership_end) return false;
                const endDate = new Date(m.membership_end);
                const now = new Date();
                const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                return diffDays > 0 && diffDays <= 7;
              }).length})
            </Button>
            <Button
              variant={viewMode === 'expiring_30days' ? 'default' : 'outline'}
              onClick={() => setViewMode('expiring_30days')}
              className={viewMode === 'expiring_30days' ? 'bg-gradient-to-r from-yellow-600 to-amber-600' : ''}
            >
              Expiring (30 days) ({members.filter(m => {
                if (!m.membership_end) return false;
                const endDate = new Date(m.membership_end);
                const now = new Date();
                const diffDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                return diffDays > 0 && diffDays <= 30;
              }).length})
            </Button>
            <Button
              variant={viewMode === 'inactive' ? 'default' : 'outline'}
              onClick={() => setViewMode('inactive')}
              className={viewMode === 'inactive' ? 'bg-gradient-to-r from-gray-600 to-slate-600' : ''}
            >
              Inactive ({members.filter(m => m.current_payment_status === 'inactive' || m.current_payment_status === 'suspended').length})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="glass border-0">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
                data-testid="member-search-input"
              />
            </div>
            <div className="w-full md:w-48">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="frozen">Frozen</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending Payment</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Members Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredMembers.map((member) => (
          <Card key={member.id} className="card-hover glass border-0" data-testid={`member-card-${member.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg text-slate-800">{member.name}</CardTitle>
                  <p className="text-sm text-slate-600">{member.email}</p>
                  <p className="text-sm text-slate-600">{member.phone}</p>
                </div>
                {getStatusBadge(member)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                {/* Membership & Fee Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600">Membership Plan</p>
                    <p className="font-medium text-slate-800">
                      {getMembershipLabel(member.membership_type)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Plan Fee</p>
                    <p className="font-medium text-slate-800">
                      {formatCurrency(member.monthly_fee_amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Admission Fee</p>
                    <p className="font-medium text-slate-800">
                      {formatCurrency(member.admission_fee_amount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-600">Total Due</p>
                    <p className="font-bold text-lg text-green-600">
                      {formatCurrency(member.total_amount_due)}
                    </p>
                  </div>
                </div>

                {/* Date Information */}
                <div className="border-t pt-3">
                  <h5 className="font-medium text-slate-800 mb-2">📅 Important Dates</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-600">Date of Joining</p>
                      <p className="font-medium text-slate-800">
                        {formatDate(member.join_date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-600">Subscription Expires</p>
                      <p className="font-medium text-red-600">
                        {formatDate(member.membership_end)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Days remaining */}
                  <div className="mt-2 text-xs text-slate-500">
                    {(() => {
                      const daysLeft = Math.ceil((new Date(member.membership_end) - new Date()) / (1000 * 60 * 60 * 24));
                      if (daysLeft < 0) return `⚠️ Expired ${Math.abs(daysLeft)} days ago`;
                      if (daysLeft === 0) return `⚠️ Expires today`;
                      if (daysLeft <= 7) return `⚠️ Expires in ${daysLeft} days`;
                      return `✅ ${daysLeft} days remaining`;
                    })()}
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-xs text-slate-600 mb-1">Emergency Contact</p>
                <p className="text-sm text-slate-800">
                  {member.emergency_contact.name} ({member.emergency_contact.relationship})
                </p>
                <p className="text-sm text-slate-600">{member.emergency_contact.phone}</p>
              </div>
              
              <div className="space-y-3">
                {/* Status Actions */}
                <div className="pt-2">
                  <p className="text-xs text-slate-600 mb-2">Quick Actions:</p>
                  {getStatusActions(member)}
                </div>
                
                {/* Main Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => sendReminderToMember(member)}
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    data-testid={`remind-member-${member.id}`}
                  >
                    📱 Send Reminder
                  </Button>
                  <MemberStartDateManager
                    member={member}
                    onUpdate={fetchMembers}
                  />
                  <MemberEndDateManager
                    member={member}
                    onUpdate={fetchMembers}
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleEdit(member)}
                    data-testid={`edit-member-${member.id}`}
                  >
                    ✏️ Edit
                  </Button>
                  {isAdmin() && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => deleteMember(member)}
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      data-testid={`delete-member-${member.id}`}
                    >
                      🗑️ Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredMembers.length === 0 && (
        <Card className="glass border-0">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No members found
            </h3>
            <p className="text-slate-600">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Add your first gym member to get started.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Member Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-50">
          <DialogHeader>
            <DialogTitle>Edit Member: {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <MemberForm 
            formData={formData}
            setFormData={setFormData}
            handleSubmit={handleSubmit}
            selectedMember={selectedMember}
            isEditModalOpen={isEditModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            isAddModalOpen={isAddModalOpen}
            setIsAddModalOpen={setIsAddModalOpen}
            resetForm={resetForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberManagement;