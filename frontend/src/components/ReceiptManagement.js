import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';

const ReceiptManagement = () => {
  const { user, token } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // Check if user is admin
  if (user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Access Denied</h3>
          <p className="text-red-600">Only administrators can manage receipt templates.</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/receipts/templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data);
      
      // Set default template as selected
      const defaultTemplate = response.data.find(t => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
      }
    } catch (error) {
      setError('Failed to load receipt templates');
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const createTemplate = async (templateData) => {
    try {
      await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/receipts/templates`,
        templateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchTemplates();
      setShowCreateDialog(false);
    } catch (error) {
      setError('Failed to create template');
      console.error('Error creating template:', error);
    }
  };

  const updateTemplate = async (templateId, templateData) => {
    try {
      await axios.put(
        `${process.env.REACT_APP_BACKEND_URL}/api/receipts/templates/${templateId}`,
        templateData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchTemplates();
      setShowEditDialog(false);
      setEditingTemplate(null);
    } catch (error) {
      setError('Failed to update template');
      console.error('Error updating template:', error);
    }
  };

  const deleteTemplate = async (templateId) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await axios.delete(
        `${process.env.REACT_APP_BACKEND_URL}/api/receipts/templates/${templateId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      fetchTemplates();
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete template');
      console.error('Error deleting template:', error);
    }
  };

  const generateSampleReceipt = async (templateId) => {
    try {
      // Generate sample receipt with mock data
      const samplePaymentId = 'sample_payment_123';
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/api/receipts/generate/${samplePaymentId}`,
        { template_id: templateId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Open receipt in new window
      const newWindow = window.open('', '_blank');
      newWindow.document.write(response.data.receipt_html);
      newWindow.document.close();
    } catch (error) {
      setError('Failed to generate sample receipt');
      console.error('Error generating sample receipt:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Receipt Management</h1>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>Create New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Receipt Template</DialogTitle>
            </DialogHeader>
            <TemplateForm onSubmit={createTemplate} onCancel={() => setShowCreateDialog(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setError(null)}
            className="mt-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Receipt Templates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium text-sm">{template.name}</h4>
                        {template.is_default && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="flex space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingTemplate(template);
                            setShowEditDialog(true);
                          }}
                        >
                          Edit
                        </Button>
                        {!template.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteTemplate(template.id);
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Template Preview */}
        <div className="lg:col-span-2">
          {selectedTemplate ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>{selectedTemplate.name}</span>
                  <Button
                    onClick={() => generateSampleReceipt(selectedTemplate.id)}
                    variant="outline"
                  >
                    Preview Receipt
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="preview" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="preview" className="space-y-4">
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <h3 className="font-medium mb-3">Template Preview</h3>
                      <ReceiptPreview template={selectedTemplate} />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="settings" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Gym Information</h4>
                        <div className="space-y-2 text-sm">
                          <div><strong>Name:</strong> {selectedTemplate.header.gym_name}</div>
                          <div><strong>Address:</strong> {selectedTemplate.header.address}</div>
                          <div><strong>Phone:</strong> {selectedTemplate.header.phone}</div>
                          <div><strong>Email:</strong> {selectedTemplate.header.email}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Styling</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center">
                            <strong>Primary Color:</strong>
                            <div 
                              className="w-4 h-4 rounded ml-2 border"
                              style={{ backgroundColor: selectedTemplate.styles.primary_color }}
                            ></div>
                            <span className="ml-2">{selectedTemplate.styles.primary_color}</span>
                          </div>
                          <div><strong>Font:</strong> {selectedTemplate.styles.font_family}</div>
                          <div><strong>Font Size:</strong> {selectedTemplate.styles.font_size}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Sections</h4>
                        <div className="space-y-1 text-sm">
                          <div>Payment Details: {selectedTemplate.sections.show_payment_details ? '✓' : '✗'}</div>
                          <div>Member Info: {selectedTemplate.sections.show_member_info ? '✓' : '✗'}</div>
                          <div>Service Details: {selectedTemplate.sections.show_service_details ? '✓' : '✗'}</div>
                          <div>Terms: {selectedTemplate.sections.show_terms ? '✓' : '✗'}</div>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Footer</h4>
                        <div className="space-y-2 text-sm">
                          <div><strong>Thank You:</strong> {selectedTemplate.footer.thank_you_message}</div>
                          <div><strong>Terms:</strong> {selectedTemplate.footer.terms_text}</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <p className="text-gray-500">Select a template to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit Template Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Receipt Template</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <TemplateForm 
              initialData={editingTemplate}
              onSubmit={(data) => updateTemplate(editingTemplate.id, data)}
              onCancel={() => {
                setShowEditDialog(false);
                setEditingTemplate(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Template Form Component
const TemplateForm = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    header: {
      gym_name: initialData?.header?.gym_name || 'Iron Paradise Gym',
      gym_logo: initialData?.header?.gym_logo || '/images/gym-logo.png',
      address: initialData?.header?.address || '123 Fitness Street, Gym City, 123456',
      phone: initialData?.header?.phone || '+91-9876543210',
      email: initialData?.header?.email || 'info@ironparadise.com',
      website: initialData?.header?.website || 'www.ironparadise.com'
    },
    styles: {
      primary_color: initialData?.styles?.primary_color || '#2563eb',
      secondary_color: initialData?.styles?.secondary_color || '#64748b',
      font_family: initialData?.styles?.font_family || 'Arial, sans-serif',
      font_size: initialData?.styles?.font_size || '14px'
    },
    sections: {
      show_payment_details: initialData?.sections?.show_payment_details ?? true,
      show_member_info: initialData?.sections?.show_member_info ?? true,
      show_service_details: initialData?.sections?.show_service_details ?? true,
      show_taxes: initialData?.sections?.show_taxes ?? true,
      show_terms: initialData?.sections?.show_terms ?? true
    },
    footer: {
      thank_you_message: initialData?.footer?.thank_you_message || 'Thank you for choosing Iron Paradise Gym!',
      terms_text: initialData?.footer?.terms_text || 'All payments are non-refundable. Terms and conditions apply.',
      contact_info: initialData?.footer?.contact_info || 'For queries, contact us at info@ironparadise.com'
    },
    is_default: initialData?.is_default || false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleInputChange = (section, field, value) => {
    if (section) {
      setFormData(prev => ({
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="name">Template Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => handleInputChange(null, 'name', e.target.value)}
          required
        />
      </div>

      <div>
        <h4 className="font-medium mb-3">Gym Information</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="gym_name">Gym Name</Label>
            <Input
              id="gym_name"
              value={formData.header.gym_name}
              onChange={(e) => handleInputChange('header', 'gym_name', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={formData.header.phone}
              onChange={(e) => handleInputChange('header', 'phone', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.header.email}
              onChange={(e) => handleInputChange('header', 'email', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.header.website}
              onChange={(e) => handleInputChange('header', 'website', e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <Label htmlFor="address">Address</Label>
          <Textarea
            id="address"
            value={formData.header.address}
            onChange={(e) => handleInputChange('header', 'address', e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-3">Styling</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="primary_color">Primary Color</Label>
            <Input
              id="primary_color"
              type="color"
              value={formData.styles.primary_color}
              onChange={(e) => handleInputChange('styles', 'primary_color', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="secondary_color">Secondary Color</Label>
            <Input
              id="secondary_color"
              type="color"
              value={formData.styles.secondary_color}
              onChange={(e) => handleInputChange('styles', 'secondary_color', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="font_family">Font Family</Label>
            <Select
              value={formData.styles.font_family}
              onValueChange={(value) => handleInputChange('styles', 'font_family', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="font_size">Font Size</Label>
            <Select
              value={formData.styles.font_size}
              onValueChange={(value) => handleInputChange('styles', 'font_size', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="12px">12px</SelectItem>
                <SelectItem value="14px">14px</SelectItem>
                <SelectItem value="16px">16px</SelectItem>
                <SelectItem value="18px">18px</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-3">Sections to Include</h4>
        <div className="space-y-3">
          {Object.entries(formData.sections).map(([key, value]) => (
            <div key={key} className="flex items-center space-x-2">
              <Switch
                id={key}
                checked={value}
                onCheckedChange={(checked) => handleInputChange('sections', key, checked)}
              />
              <Label htmlFor={key} className="capitalize">
                {key.replace('show_', '').replace('_', ' ')}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="font-medium mb-3">Footer</h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="thank_you_message">Thank You Message</Label>
            <Input
              id="thank_you_message"
              value={formData.footer.thank_you_message}
              onChange={(e) => handleInputChange('footer', 'thank_you_message', e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="terms_text">Terms Text</Label>
            <Textarea
              id="terms_text"
              value={formData.footer.terms_text}
              onChange={(e) => handleInputChange('footer', 'terms_text', e.target.value)}
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="contact_info">Contact Information</Label>
            <Input
              id="contact_info"
              value={formData.footer.contact_info}
              onChange={(e) => handleInputChange('footer', 'contact_info', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </form>
  );
};

// Receipt Preview Component
const ReceiptPreview = ({ template }) => {
  return (
    <div className="border rounded-lg bg-white p-4" style={{ fontFamily: template.styles.font_family, fontSize: template.styles.font_size }}>
      <div className="text-center border-b-2 pb-4 mb-4" style={{ borderColor: template.styles.primary_color }}>
        <div className="text-2xl font-bold mb-2" style={{ color: template.styles.primary_color }}>
          {template.header.gym_name}
        </div>
        <div className="text-sm" style={{ color: template.styles.secondary_color }}>
          {template.header.address}<br />
          Phone: {template.header.phone}<br />
          Email: {template.header.email}
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="font-bold mb-2" style={{ color: template.styles.primary_color }}>Payment Receipt</h3>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>Receipt ID:</span>
            <span>SAMPLE-123456</span>
          </div>
          <div className="flex justify-between">
            <span>Date:</span>
            <span>{new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {template.sections.show_member_info && (
        <div className="mb-4">
          <h4 className="font-bold mb-2" style={{ color: template.styles.primary_color }}>Member Information</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Name:</span>
              <span>John Doe</span>
            </div>
            <div className="flex justify-between">
              <span>Email:</span>
              <span>john.doe@example.com</span>
            </div>
          </div>
        </div>
      )}

      {template.sections.show_service_details && (
        <div className="mb-4">
          <h4 className="font-bold mb-2" style={{ color: template.styles.primary_color }}>Service Details</h4>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>Service:</span>
              <span>Monthly Membership</span>
            </div>
            <div className="flex justify-between">
              <span>Amount:</span>
              <span>₹2,000</span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center p-4 rounded font-bold" style={{ backgroundColor: template.styles.primary_color, color: 'white' }}>
        Total Paid: ₹2,000
      </div>

      <div className="text-center mt-4 text-sm">
        <div className="font-bold mb-2" style={{ color: template.styles.primary_color }}>
          {template.footer.thank_you_message}
        </div>
        {template.sections.show_terms && (
          <div className="mb-2" style={{ color: template.styles.secondary_color }}>
            {template.footer.terms_text}
          </div>
        )}
        <div style={{ color: template.styles.secondary_color }}>
          {template.footer.contact_info}
        </div>
      </div>
    </div>
  );
};

export default ReceiptManagement;