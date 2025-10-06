import React, { useState } from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { apiClient } from '../App';
import { toast } from 'sonner';
import useRazorpay from 'react-razorpay';

const RazorpayPayment = ({ member, amount, description, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [Razorpay] = useRazorpay();

  const handlePayment = async () => {
    try {
      setLoading(true);
      
      // Create Razorpay order
      const orderResponse = await apiClient.post('/razorpay/create-order', {
        member_id: member.id,
        amount: amount,
        description: description
      });

      const { order_id, amount: razorpay_amount, currency, key_id } = orderResponse.data;

      const options = {
        key: key_id,
        amount: razorpay_amount,
        currency: currency,
        name: 'Iron Paradise Gym',
        description: description,
        order_id: order_id,
        handler: async function (response) {
          try {
            // Verify payment on backend
            const verifyResponse = await apiClient.post('/razorpay/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              member_id: member.id,
              description: description
            });

            if (verifyResponse.data.status === 'success') {
              toast.success('Payment successful!');
              if (onSuccess) onSuccess(response);
            }
          } catch (error) {
            console.error('Payment verification failed:', error);
            toast.error('Payment verification failed. Please contact support.');
            if (onError) onError(error);
          }
        },
        prefill: {
          name: member.name,
          email: member.email,
          contact: member.phone
        },
        notes: {
          member_id: member.id,
          member_name: member.name
        },
        theme: {
          color: '#3b82f6'
        },
        modal: {
          ondismiss: function() {
            toast.info('Payment cancelled');
            setLoading(false);
          }
        }
      };

      const rzpay = new Razorpay(options);
      rzpay.open();

    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error('Failed to initiate payment. Please try again.');
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg text-slate-800">Online Payment</h3>
          <p className="text-sm text-slate-600">Pay securely with Razorpay</p>
        </div>
        <Badge className="bg-blue-100 text-blue-800 border-blue-200">
          🔒 Secure
        </Badge>
      </div>

      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <span className="text-slate-600">Member:</span>
          <span className="font-medium">{member.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Amount:</span>
          <span className="font-bold text-lg text-green-600">{formatCurrency(amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">Description:</span>
          <span className="font-medium text-right max-w-48">{description}</span>
        </div>
      </div>

      <Button 
        onClick={handlePayment}
        disabled={loading}
        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        {loading ? (
          <div className="flex items-center">
            <div className="spinner mr-2"></div>
            Processing...
          </div>
        ) : (
          <>
            💳 Pay {formatCurrency(amount)}
          </>
        )}
      </Button>

      <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-slate-500">
        <span>💳 Cards</span>
        <span>📱 UPI</span>
        <span>🏦 Net Banking</span>
        <span>📱 Wallets</span>
      </div>
    </div>
  );
};

export default RazorpayPayment;