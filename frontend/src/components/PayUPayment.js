import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const PayUPayment = ({ memberData, amount, productInfo, onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const { token } = useAuth();
  
  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  const initiatePayUPayment = async () => {
    if (!amount || amount <= 0) {
      onError('Invalid payment amount');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Prepare payment data
      const paymentData = {
        amount: parseFloat(amount),
        product_info: productInfo || 'Gym Membership Payment',
        customer_name: memberData?.name || 'Gym Member',
        customer_email: memberData?.email || 'member@gym.com',
        customer_phone: memberData?.phone || '9999999999',
        member_id: memberData?.id || '',
        membership_type: memberData?.membership_type || 'monthly',
        payment_for: 'membership',
        gym_branch: 'main'
      };

      // Create PayU payment order
      const response = await axios.post(
        `${backendUrl}/api/payu/create-order`,
        paymentData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status === 'success') {
        // Create form and submit to PayU
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = response.data.payment_url;

        // Add all PayU parameters as hidden inputs
        Object.keys(response.data.params).forEach(key => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = response.data.params[key];
          form.appendChild(input);
        });

        // Append form to body and submit
        document.body.appendChild(form);
        form.submit();
        
        // The user will be redirected to PayU payment page
        // After payment, they will be redirected back to our success/failure URLs
      } else {
        onError(response.data.error || 'Failed to create payment order');
      }
    } catch (error) {
      console.error('PayU payment initiation error:', error);
      onError(error.response?.data?.detail || 'Payment initiation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="payu-payment-container">
      <div className="payment-gateway-info">
        <h3>PayU Payment Gateway</h3>
        <p>Secure payment powered by PayU</p>
        <div className="payment-methods">
          <span className="payment-method">Credit Card</span>
          <span className="payment-method">Debit Card</span>
          <span className="payment-method">Net Banking</span>
          <span className="payment-method">UPI</span>
          <span className="payment-method">Wallets</span>
        </div>
      </div>
      
      <div className="payment-details">
        <div className="amount-display">
          <span className="currency">₹</span>
          <span className="amount">{amount}</span>
        </div>
        <div className="product-info">
          <p>{productInfo || 'Gym Membership Payment'}</p>
        </div>
      </div>
      
      <button
        className={`payu-pay-button ${isProcessing ? 'processing' : ''}`}
        onClick={initiatePayUPayment}
        disabled={isProcessing || !amount}
      >
        {isProcessing ? (
          <>
            <span className="spinner"></span>
            Processing...
          </>
        ) : (
          `Pay ₹${amount} with PayU`
        )}
      </button>
      
      <div className="security-info">
        <p>🔒 Your payment is secured by PayU's 256-bit SSL encryption</p>
      </div>
      
      <style jsx>{`
        .payu-payment-container {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 20px;
          margin: 10px 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .payment-gateway-info h3 {
          margin: 0 0 10px 0;
          color: white;
        }
        
        .payment-methods {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin: 10px 0;
        }
        
        .payment-method {
          background: rgba(255, 255, 255, 0.2);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }
        
        .payment-details {
          margin: 20px 0;
          text-align: center;
        }
        
        .amount-display {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .currency {
          font-size: 24px;
          vertical-align: top;
        }
        
        .payu-pay-button {
          width: 100%;
          padding: 15px 20px;
          font-size: 16px;
          font-weight: bold;
          background: #ff6b35;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .payu-pay-button:hover:not(:disabled) {
          background: #e55a2b;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .payu-pay-button:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
        }
        
        .payu-pay-button.processing {
          background: #999;
        }
        
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid transparent;
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .security-info {
          margin-top: 15px;
          text-align: center;
          font-size: 12px;
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
};

export default PayUPayment;