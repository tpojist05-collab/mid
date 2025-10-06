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

const MemberManagement = () => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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

  // Filter members based on search and status
  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.phone.includes(searchTerm);
    
    if (statusFilter === 'all') return matchesSearch;
    
    const isExpired = new Date(member.membership_end) < new Date();
    
    switch (statusFilter) {
      case 'active':
        return matchesSearch && member.current_payment_status === 'paid' && !isExpired;
      case 'pending':
        return matchesSearch && member.current_payment_status === 'pending';
      case 'expired':
        return matchesSearch && isExpired;
      default:
        return matchesSearch;
    }
  });

  const MemberForm = () => (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter member's full name"
            required
            data-testid="member-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="member@example.com"
            required
            data-testid="member-email-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+91 98765 43210"
            required
            data-testid="member-phone-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="membership_type">Membership Plan</Label>
          <Select 
            value={formData.membership_type} 
            onValueChange={(value) => setFormData({ ...formData, membership_type: value })}
          >
            <SelectTrigger data-testid="membership-type-select">
              <SelectValue placeholder="Select membership type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly - ₹2,000 + ₹1,500 (admission)</SelectItem>
              <SelectItem value="quarterly">Quarterly - ₹5,500 + ₹1,500 (admission)</SelectItem>
              <SelectItem value="six_monthly">Six Monthly - ₹10,500 + ₹1,500 (admission)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Enter member's full address"
          required
          data-testid="member-address-input"
        />
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium text-slate-800 mb-4">Emergency Contact</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="emergency_name">Contact Name</Label>
            <Input
              id="emergency_name"
              value={formData.emergency_contact.name}
              onChange={(e) => setFormData({
                ...formData,
                emergency_contact: { ...formData.emergency_contact, name: e.target.value }
              })}
              placeholder="Emergency contact name"
              required
              data-testid="emergency-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency_phone">Contact Phone</Label>
            <Input
              id="emergency_phone"
              value={formData.emergency_contact.phone}
              onChange={(e) => setFormData({
                ...formData,
                emergency_contact: { ...formData.emergency_contact, phone: e.target.value }
              })}
              placeholder="Contact phone number"
              required
              data-testid="emergency-phone-input"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="emergency_relationship">Relationship</Label>
            <Input
              id="emergency_relationship"
              value={formData.emergency_contact.relationship}
              onChange={(e) => setFormData({
                ...formData,
                emergency_contact: { ...formData.emergency_contact, relationship: e.target.value }
              })}
              placeholder="e.g., Spouse, Parent, Sibling"
              required
              data-testid="emergency-relationship-input"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (selectedMember) {
              setIsEditModalOpen(false);
            } else {
              setIsAddModalOpen(false);
            }
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" data-testid="save-member-btn">
          {selectedMember ? 'Update Member' : 'Add Member'}
        </Button>
      </div>
    </form>
  );

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
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" data-testid="add-member-btn">
              Add New Member
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Member</DialogTitle>
            </DialogHeader>
            <MemberForm />
          </DialogContent>
        </Dialog>
      </div>

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
                  <SelectItem value="all">All Members</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
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
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Membership</p>
                  <p className="font-medium text-slate-800">
                    {getMembershipLabel(member.membership_type)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Monthly Fee</p>
                  <p className="font-medium text-slate-800">
                    {formatCurrency(member.monthly_fee_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Join Date</p>
                  <p className="font-medium text-slate-800">
                    {formatDate(member.join_date)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">Expires On</p>
                  <p className="font-medium text-slate-800">
                    {formatDate(member.membership_end)}
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-3">
                <p className="text-xs text-slate-600 mb-1">Emergency Contact</p>
                <p className="text-sm text-slate-800">
                  {member.emergency_contact.name} ({member.emergency_contact.relationship})
                </p>
                <p className="text-sm text-slate-600">{member.emergency_contact.phone}</p>
              </div>
              
              <div className="flex justify-end pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEdit(member)}
                  data-testid={`edit-member-${member.id}`}
                >
                  Edit Member
                </Button>
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Member: {selectedMember?.name}</DialogTitle>
          </DialogHeader>
          <MemberForm />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MemberManagement;