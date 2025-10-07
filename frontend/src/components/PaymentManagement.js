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
import RazorpayPayment from './RazorpayPayment';
import PaymentForm from './forms/PaymentForm';

const PaymentManagement = () => {
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [showPayU, setShowPayU] = useState(false);
  const [selectedMemberForPayment, setSelectedMemberForPayment] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    payment_method: 'cash',
    description: '',
    transaction_id: ''
  });

  useEffect(() => {
    fetchPaymentsAndMembers();
    
    // Listen for custom events from dashboard
    const handleAddPayment = () => setIsAddModalOpen(true);
    window.addEventListener('openPaymentModal', handleAddPayment);
    
    return () => {
      window.removeEventListener('openPaymentModal', handleAddPayment);
    };
  }, []);

  const fetchPaymentsAndMembers = async () => {
    try {
      setLoading(true);
      const [paymentsRes, membersRes] = await Promise.all([
        apiClient.get('/payments'),
        apiClient.get('/members')
      ]);
      
      setPayments(paymentsRes.data);
      setMembers(membersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleManualPaymentSubmit = async () => {
    try {
      const paymentData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };
      
      const response = await apiClient.post('/payments', paymentData);
      toast.success('Payment recorded successfully');
      
      // Generate receipt immediately after payment
      if (response.data.payment_id) {
        try {
          const receiptResponse = await apiClient.post(
            `/payments/${response.data.payment_id}/receipt`,
            {}
          );
          
          // Open receipt in new window
          const newWindow = window.open('', '_blank');
          newWindow.document.write(receiptResponse.data.receipt_html);
          newWindow.document.close();
          
          toast.success('Receipt generated and opened!');
        } catch (receiptError) {
          console.error('Error generating receipt:', receiptError);
          toast.error('Payment recorded but receipt generation failed');
        }
      }
      
      setIsAddModalOpen(false);
      fetchPaymentsAndMembers();
      resetForm();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    }
  };

  const generateReceiptForPayment = async (paymentId) => {
    try {
      const response = await apiClient.post(
        `/payments/${paymentId}/receipt`,
        {}
      );
      
      // Open receipt in new window
      const newWindow = window.open('', '_blank');
      newWindow.document.write(response.data.receipt_html);
      newWindow.document.close();
      
      toast.success('Receipt generated successfully!');
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Failed to generate receipt');
    }
  };

  const resetForm = () => {
    setFormData({
      member_id: '',
      amount: '',
      payment_method: 'cash',
      description: '',
      transaction_id: ''
    });
    setShowRazorpay(false);
    setShowPayU(false);
    setSelectedMemberForPayment(null);
  };

  const getMemberName = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.name : 'Unknown Member';
  };

  const getMemberPhone = (memberId) => {
    const member = members.find(m => m.id === memberId);
    return member ? member.phone : '';
  };

  const getPaymentMethodBadge = (method) => {
    const colors = {
      cash: 'bg-green-100 text-green-800 border-green-200',
      card: 'bg-blue-100 text-blue-800 border-blue-200',
      upi: 'bg-purple-100 text-purple-800 border-purple-200',
      razorpay: 'bg-orange-100 text-orange-800 border-orange-200',
      payu: 'bg-purple-100 text-purple-800 border-purple-200'
    };
    
    return (
      <Badge className={colors[method] || 'bg-gray-100 text-gray-800 border-gray-200'}>
        {method.toUpperCase()}
      </Badge>
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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Filter payments based on search
  const filteredPayments = payments.filter(payment => {
    const memberName = getMemberName(payment.member_id).toLowerCase();
    const memberPhone = getMemberPhone(payment.member_id);
    const description = payment.description.toLowerCase();
    const searchLower = searchTerm.toLowerCase();
    
    return memberName.includes(searchLower) ||
           memberPhone.includes(searchLower) ||
           description.includes(searchLower) ||
           payment.amount.toString().includes(searchLower);
  });

  // Calculate stats
  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const todayPayments = payments.filter(payment => {
    const today = new Date();
    const paymentDate = new Date(payment.payment_date);
    return paymentDate.toDateString() === today.toDateString();
  });
  const todayRevenue = todayPayments.reduce((sum, payment) => sum + payment.amount, 0);

  // PaymentForm component moved to separate file to prevent re-creation and focus loss

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="spinner"></div>
        <span className="ml-3 text-slate-600">Loading payments...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Payment Management</h2>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700" data-testid="add-payment-btn">
              Record Payment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Record New Payment</DialogTitle>
            </DialogHeader>
            <PaymentForm 
              formData={formData}
              setFormData={setFormData}
              members={members}
              showRazorpay={showRazorpay}
              setShowRazorpay={setShowRazorpay}
              showPayU={showPayU}
              setShowPayU={setShowPayU}
              selectedMemberForPayment={selectedMemberForPayment}
              setSelectedMemberForPayment={setSelectedMemberForPayment}
              handleManualPaymentSubmit={handleManualPaymentSubmit}
              isAddModalOpen={isAddModalOpen}
              setIsAddModalOpen={setIsAddModalOpen}
              resetForm={resetForm}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Revenue Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800" data-testid="total-revenue">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              From {payments.length} payments
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Today's Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="today-revenue">
              {formatCurrency(todayRevenue)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              From {todayPayments.length} payments
            </p>
          </CardContent>
        </Card>
        
        <Card className="glass border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-700">Average Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="average-payment">
              {payments.length > 0 ? formatCurrency(totalRevenue / payments.length) : formatCurrency(0)}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Filter */}
      <Card className="glass border-0">
        <CardContent className="pt-6">
          <Input
            placeholder="Search by member name, phone, amount, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
            data-testid="payment-search-input"
          />
        </CardContent>
      </Card>

      {/* Payments List */}
      <div className="space-y-4">
        {filteredPayments.map((payment) => (
          <Card key={payment.id} className="card-hover glass border-0" data-testid={`payment-card-${payment.id}`}>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-slate-800 text-lg">
                      {getMemberName(payment.member_id)}
                    </h3>
                    {getPaymentMethodBadge(payment.payment_method)}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-600">
                    <div>
                      <span className="font-medium">Phone:</span> {getMemberPhone(payment.member_id)}
                    </div>
                    <div>
                      <span className="font-medium">Date:</span> {formatDate(payment.payment_date)}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium">Description:</span> {payment.description}
                    </div>
                    {payment.transaction_id && (
                      <div className="md:col-span-2">
                        <span className="font-medium">Transaction ID:</span> {payment.transaction_id}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-3xl font-bold text-green-600 mb-1">
                    {formatCurrency(payment.amount)}
                  </div>
                  <div className="text-sm text-slate-500 mb-3">
                    Payment #{payment.id.slice(-6)}
                  </div>
                  <Button
                    onClick={() => generateReceiptForPayment(payment.id)}
                    variant="outline"
                    size="sm"
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                  >
                    📄 Generate Receipt
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredPayments.length === 0 && (
        <Card className="glass border-0">
          <CardContent className="text-center py-12">
            <div className="text-4xl mb-4">💳</div>
            <h3 className="text-lg font-medium text-slate-800 mb-2">
              No payments found
            </h3>
            <p className="text-slate-600">
              {searchTerm 
                ? 'Try adjusting your search criteria.'
                : 'Record your first payment to get started.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentManagement;