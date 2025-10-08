import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

const MemberForm = ({
  formData,
  setFormData,
  handleSubmit,
  selectedMember,
  isEditModalOpen,
  setIsEditModalOpen,
  isAddModalOpen,
  setIsAddModalOpen,
  resetForm
}) => {
  
  // Calculate enrollment amount based on membership type and enrollment status
  const calculateEnrollmentAmount = (membershipType, isExistingMember = false) => {
    const amounts = {
      monthly: {
        first: 2500,  // First month
        subsequent: 1000  // Subsequent months
      },
      quarterly: {
        first: 3500,  // First quarter
        subsequent: 3000  // Subsequent quarters
      },
      six_monthly: {
        first: 6000,  // First half-year
        subsequent: 5500  // Subsequent half-years
      }
    };
    
    if (!membershipType || !amounts[membershipType]) {
      return 0;
    }
    
    return isExistingMember ? amounts[membershipType].subsequent : amounts[membershipType].first;
  };
  
  // Get current enrollment amount
  const enrollmentAmount = calculateEnrollmentAmount(formData.membership_type, !!selectedMember);
  
  // Get amount description
  const getAmountDescription = (membershipType, isExistingMember = false) => {
    const descriptions = {
      monthly: isExistingMember ? 'Subsequent month fee' : 'First month fee (includes setup)',
      quarterly: isExistingMember ? 'Renewal quarter fee' : 'First quarter fee (includes setup)',
      six_monthly: isExistingMember ? 'Renewal half-year fee' : 'First half-year fee (includes setup)'
    };
    
    return descriptions[membershipType] || 'Enrollment fee';
  };
  return (
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
          <Label htmlFor="join_date">Date of Joining</Label>
          <Input
            id="join_date"
            type="date"
            value={formData.join_date}
            onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
            max={new Date().toISOString().split('T')[0]} // Today's date as maximum
            required
            data-testid="member-join-date-input"
          />
          <div className="text-xs text-slate-500 mt-1">
            📅 You can backdate or use current date
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <SelectItem value="monthly">Monthly Plan</SelectItem>
              <SelectItem value="quarterly">Quarterly Plan (3 months)</SelectItem>
              <SelectItem value="six_monthly">Six Monthly Plan (6 months)</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-slate-500 mt-1">
            💰 Admin will set pricing in settings
          </div>
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
};

export default MemberForm;