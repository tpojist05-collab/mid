import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../App';
import { toast } from 'sonner';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { user, isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'receptionist',
    custom_role_id: ''
  });

  useEffect(() => {
    if (isAdmin()) {
      fetchUsers();
      fetchRoles();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await apiClient.get('/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedUser) {
        await apiClient.put(`/users/${selectedUser.id}`, formData);
        toast.success('User updated successfully');
        setIsEditModalOpen(false);
      } else {
        await apiClient.post('/auth/register', formData);
        toast.success('User added successfully');
        setIsAddModalOpen(false);
      }
      
      fetchUsers();
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const deleteUser = async (userToDelete) => {
    if (!window.confirm(`Are you sure you want to delete ${userToDelete.full_name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await apiClient.delete(`/users/${userToDelete.id}`);
      toast.success(`User ${userToDelete.full_name} deleted successfully`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    }
  };

  const handleEdit = (userToEdit) => {
    setSelectedUser(userToEdit);
    setFormData({
      username: userToEdit.username,
      email: userToEdit.email,
      full_name: userToEdit.full_name,
      password: '', // Don't prefill password
      role: userToEdit.role,
      custom_role_id: userToEdit.custom_role_id || ''
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      full_name: '',
      password: '',
      role: 'receptionist',
      custom_role_id: ''
    });
    setSelectedUser(null);
  };

  const getRoleBadge = (userRole, customRoleId) => {
    const colors = {
      admin: 'bg-red-100 text-red-800 border-red-200',
      manager: 'bg-blue-100 text-blue-800 border-blue-200',
      trainer: 'bg-green-100 text-green-800 border-green-200',
      receptionist: 'bg-purple-100 text-purple-800 border-purple-200'
    };

    let displayRole = userRole;
    let customRole = null;

    if (customRoleId) {
      customRole = roles.find(r => r.id === customRoleId);
      if (customRole) {
        displayRole = customRole.name;
      }
    }

    return (
      <Badge className={colors[userRole] || 'bg-gray-100 text-gray-800 border-gray-200'}>
        {userRole === 'admin' ? '👑' : 
         userRole === 'manager' ? '💼' : 
         userRole === 'trainer' ? '💪' : '🏢'} {displayRole}
      </Badge>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="glass border-0">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">Access Denied</h3>
            <p className="text-slate-600">Only administrators can access user management.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <span className="ml-3 text-slate-600">Loading users...</span>
      </div>
    );
  }

  const UserForm = () => (
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

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">User Management</h2>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700" data-testid="add-user-btn">
              👤 Add New User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <UserForm />
          </DialogContent>
        </Dialog>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {users.map((userData) => (
          <Card key={userData.id} className="card-hover glass border-0" data-testid={`user-card-${userData.id}`}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg text-slate-800 flex items-center gap-2">
                    {userData.full_name}
                    {userData.id === user.id && (
                      <Badge variant="outline" className="text-xs">You</Badge>
                    )}
                  </CardTitle>
                  <p className="text-sm text-slate-600">@{userData.username}</p>
                  <p className="text-sm text-slate-600">{userData.email}</p>
                </div>
                {getRoleBadge(userData.role, userData.custom_role_id)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Created:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(userData.created_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Last Login:</span>
                  <span className="font-medium text-slate-800">
                    {formatDate(userData.last_login)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Status:</span>
                  <Badge className={userData.is_active ? 'status-paid' : 'status-pending'}>
                    {userData.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEdit(userData)}
                  data-testid={`edit-user-${userData.id}`}
                >
                  ✏️ Edit
                </Button>
                {userData.id !== user.id && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => deleteUser(userData)}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    data-testid={`delete-user-${userData.id}`}
                  >
                    🗑️ Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {users.length === 0 && (
        <Card className="glass border-0">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">No users found</h3>
            <p className="text-slate-600">Add your first user to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Edit User: {selectedUser?.full_name}</DialogTitle>
          </DialogHeader>
          <UserForm />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;