import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import RazorpayPayment from '../RazorpayPayment';
import PayUPayment from '../PayUPayment';
import { toast } from 'sonner';

const PaymentForm = ({
  formData,
  setFormData,
  members,
  showRazorpay,
  setShowRazorpay,
  showPayU,
  setShowPayU,
  selectedMemberForPayment,
  setSelectedMemberForPayment,
  handleManualPaymentSubmit,
  isAddModalOpen,
  setIsAddModalOpen,
  resetForm
}) => {
  return (
    <div className="space-y-6">
      {!showRazorpay && !showPayU ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="member_id">Select Member</Label>
              <Select 
                value={formData.member_id} 
                onValueChange={(value) => {
                  setFormData({ ...formData, member_id: value });
                  const member = members.find(m => m.id === value);
                  setSelectedMemberForPayment(member);
                }}
                required
              >
                <SelectTrigger data-testid="payment-member-select">
                  <SelectValue placeholder="Choose a member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name} - {member.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₹)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="Enter payment amount"
                required
                data-testid="payment-amount-input"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Monthly membership fee, Admission fee, etc."
              required
              data-testid="payment-description-input"
            />
          </div>

          {/* Payment Method Selection */}
          <div className="border-t pt-4">
            <h4 className="font-medium text-slate-800 mb-4">Choose Payment Method</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Manual Payment */}
              <div className="border rounded-lg p-4">
                <h5 className="font-medium mb-2">Manual Payment</h5>
                <p className="text-sm text-slate-600 mb-4">Record cash, card, or UPI payment received offline</p>
                
                <div className="space-y-3">
                  <Select 
                    value={formData.payment_method} 
                    onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                  >
                    <SelectTrigger data-testid="payment-method-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Debit/Credit Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder="Transaction ID (Optional)"
                    value={formData.transaction_id}
                    onChange={(e) => setFormData({ ...formData, transaction_id: e.target.value })}
                    data-testid="transaction-id-input"
                  />
                </div>
                
                <Button 
                  type="button"
                  onClick={handleManualPaymentSubmit}
                  className="w-full mt-4"
                  data-testid="save-payment-btn"
                >
                  Record Manual Payment
                </Button>
              </div>

              {/* Online Payment */}
              <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h5 className="font-medium mb-2 flex items-center">
                  Online Payment 
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Recommended</Badge>
                </h5>
                <p className="text-sm text-slate-600 mb-4">Choose your preferred payment gateway</p>
                
                <div className="space-y-2">
                  <Button 
                    type="button"
                    onClick={() => {
                      if (!formData.member_id || !formData.amount || !formData.description) {
                        toast.error('Please fill in member, amount, and description first');
                        return;
                      }
                      setShowRazorpay(true);
                    }}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    disabled={!formData.member_id || !formData.amount || !formData.description}
                  >
                    💳 Pay with Razorpay
                  </Button>
                  
                  <Button 
                    type="button"
                    onClick={() => {
                      if (!formData.member_id || !formData.amount || !formData.description) {
                        toast.error('Please fill in member, amount, and description first');
                        return;
                      }
                      setShowPayU(true);
                    }}
                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                    disabled={!formData.member_id || !formData.amount || !formData.description}
                  >
                    🚀 Pay with PayU
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-slate-800">
              {showRazorpay ? 'Razorpay Payment' : 'PayU Payment'}
            </h4>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowRazorpay(false);
                setShowPayU(false);
              }}
            >
              ← Back to Payment Options
            </Button>
          </div>
          
          {selectedMemberForPayment && (
            <>
              {showRazorpay && (
                <RazorpayPayment
                  member={selectedMemberForPayment}
                  amount={parseFloat(formData.amount)}
                  description={formData.description}
                  onSuccess={(response) => {
                    toast.success('Razorpay payment completed successfully!');
                    setIsAddModalOpen(false);
                    setShowRazorpay(false);
                    resetForm();
                  }}
                  onError={(error) => {
                    console.error('Razorpay payment error:', error);
                    toast.error('Payment failed. Please try again.');
                  }}
                />
              )}
              
              {showPayU && (
                <PayUPayment
                  memberData={selectedMemberForPayment}
                  amount={parseFloat(formData.amount)}
                  productInfo={formData.description}
                  onSuccess={(response) => {
                    toast.success('PayU payment completed successfully!');
                    setIsAddModalOpen(false);
                    setShowPayU(false);
                    resetForm();
                  }}
                  onError={(error) => {
                    console.error('PayU payment error:', error);
                    toast.error(`Payment failed: ${error}`);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {!showRazorpay && !showPayU && (
        <div className="flex justify-end gap-3 pt-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => {
              setIsAddModalOpen(false);
              setShowRazorpay(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

export default PaymentForm;