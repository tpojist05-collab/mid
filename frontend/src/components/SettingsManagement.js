import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../App';
import { toast } from 'sonner';

const SettingsManagement = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { user, isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    gym_name: '',
    gym_address: '',
    gym_phone: '',
    gym_email: '',
    gym_logo_url: '',
    terms_conditions: '',
    membership_plans: {},
    admission_fee: 0
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/settings');
      setSettings(response.data);
      setFormData({
        gym_name: response.data.gym_name || '',
        gym_address: response.data.gym_address || '',
        gym_phone: response.data.gym_phone || '',
        gym_email: response.data.gym_email || '',
        gym_logo_url: response.data.gym_logo_url || '',
        terms_conditions: response.data.terms_conditions || '',
        membership_plans: response.data.membership_plans || {},
        admission_fee: response.data.admission_fee || 0
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await apiClient.put('/settings', formData);
      toast.success('Settings updated successfully');
      fetchSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateMembershipPlan = (planId, field, value) => {
    setFormData({
      ...formData,
      membership_plans: {
        ...formData.membership_plans,
        [planId]: {
          ...formData.membership_plans[planId],
          [field]: field === 'price' ? parseFloat(value) || 0 : value
        }
      }
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="glass border-0">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              Access Denied
            </h3>
            <p className="text-slate-600">
              Only administrators can access settings management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <span className="ml-3 text-slate-600">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">System Settings</h2>
        <div className="flex items-center gap-2">
          <Badge className="bg-green-100 text-green-800 border-green-200">
            Admin Access
          </Badge>
          <Button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            data-testid="save-settings"
          >
            {saving ? (
              <div className="flex items-center">
                <div className="spinner mr-2"></div>
                Saving...
              </div>
            ) : (
              '💾 Save All Settings'
            )}
          </Button>
        </div>
      </div>

      {/* Gym Information */}
      <Card className="glass border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">🏢</span>
            Gym Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gym_name">Gym Name</Label>
              <Input
                id="gym_name"
                value={formData.gym_name}
                onChange={(e) => setFormData({ ...formData, gym_name: e.target.value })}
                placeholder="Enter gym name"
                data-testid="gym-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gym_email">Gym Email</Label>
              <Input
                id="gym_email"
                type="email"
                value={formData.gym_email}
                onChange={(e) => setFormData({ ...formData, gym_email: e.target.value })}
                placeholder="gym@example.com"
                data-testid="gym-email-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="gym_phone">Phone Number</Label>
              <Input
                id="gym_phone"
                value={formData.gym_phone}
                onChange={(e) => setFormData({ ...formData, gym_phone: e.target.value })}
                placeholder="+91 98765 43210"
                data-testid="gym-phone-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gym_logo_url">Logo URL (Optional)</Label>
              <Input
                id="gym_logo_url"
                value={formData.gym_logo_url}
                onChange={(e) => setFormData({ ...formData, gym_logo_url: e.target.value })}
                placeholder="https://example.com/logo.png"
                data-testid="gym-logo-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gym_address">Gym Address</Label>
            <Textarea
              id="gym_address"
              value={formData.gym_address}
              onChange={(e) => setFormData({ ...formData, gym_address: e.target.value })}
              placeholder="Enter complete gym address"
              rows={3}
              data-testid="gym-address-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Membership Plans */}
      <Card className="glass border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">💳</span>
            Membership Plans & Pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(formData.membership_plans).map(([planId, plan]) => (
              <div key={planId} className="border rounded-lg p-4 bg-white/50">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Plan Name</Label>
                    <Input
                      value={plan.name || ''}
                      onChange={(e) => updateMembershipPlan(planId, 'name', e.target.value)}
                      placeholder="Plan name"
                      data-testid={`plan-name-${planId}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Price (₹)</Label>
                    <Input
                      type="number"
                      value={plan.price || ''}
                      onChange={(e) => updateMembershipPlan(planId, 'price', e.target.value)}
                      placeholder="0"
                      data-testid={`plan-price-${planId}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (Days)</Label>
                    <Input
                      type="number"
                      value={plan.duration_days || ''}
                      onChange={(e) => updateMembershipPlan(planId, 'duration_days', parseInt(e.target.value) || 0)}
                      placeholder="30"
                      data-testid={`plan-duration-${planId}`}
                    />
                  </div>
                </div>
                <div className="mt-3 text-sm text-slate-600">
                  <strong>Preview:</strong> {plan.name} - {formatCurrency(plan.price || 0)} for {plan.duration_days || 0} days
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <h4 className="font-medium text-slate-800 mb-2">💡 Pricing Tips</h4>
            <ul className="text-sm text-slate-600 space-y-1">
              <li>• Longer plans typically offer better value to encourage commitment</li>
              <li>• Consider seasonal discounts for annual memberships</li>
              <li>• Admission fee is always ₹1,500 (configured separately)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Terms & Conditions */}
      <Card className="glass border-0">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">📋</span>
            Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="terms_conditions">Membership Terms</Label>
            <Textarea
              id="terms_conditions"
              value={formData.terms_conditions}
              onChange={(e) => setFormData({ ...formData, terms_conditions: e.target.value })}
              placeholder="Enter terms and conditions for membership"
              rows={6}
              data-testid="terms-conditions-input"
            />
          </div>
          <div className="mt-3 text-xs text-slate-500">
            These terms will appear on receipts and membership agreements.
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card className="glass border-0 bg-gradient-to-r from-slate-50 to-gray-100">
        <CardHeader>
          <CardTitle className="text-slate-800 flex items-center">
            <span className="mr-2">ℹ️</span>
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-slate-600">Last Updated By:</p>
              <p className="font-medium">{settings?.updated_by || 'System'}</p>
            </div>
            <div>
              <p className="text-slate-600">Last Updated:</p>
              <p className="font-medium">
                {settings?.updated_at ? 
                  new Date(settings.updated_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Never'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsManagement;