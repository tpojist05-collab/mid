import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const UserForm = ({
  formData,
  setFormData,
  handleSubmit,
  selectedUser,
  isEditModalOpen,
  setIsEditModalOpen,
  isAddModalOpen,
  setIsAddModalOpen,
  resetForm
}) => {
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Enter username"
            required
            data-testid="user-username-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
            required
            data-testid="user-email-input"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            placeholder="Enter full name"
            required
            data-testid="user-fullname-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password {selectedUser && '(leave blank to keep current)'}</Label>
          <Input
            id="password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder={selectedUser ? "Leave blank to keep current" : "Enter password"}
            required={!selectedUser}
            data-testid="user-password-input"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select 
          value={formData.role} 
          onValueChange={(value) => setFormData({ ...formData, role: value })}
        >
          <SelectTrigger data-testid="user-role-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">👑 Administrator</SelectItem>
            <SelectItem value="manager">💼 Manager</SelectItem>
            <SelectItem value="trainer">💪 Trainer</SelectItem>
            <SelectItem value="receptionist">🏢 Receptionist</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (selectedUser) {
              setIsEditModalOpen(false);
            } else {
              setIsAddModalOpen(false);
            }
            resetForm();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" data-testid="save-user-btn">
          {selectedUser ? 'Update User' : 'Add User'}
        </Button>
      </div>
    </form>
  );
};

export default UserForm;