import os
import hashlib
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import logging
import requests
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

class PayUService:
    """PayU Payment Gateway Service for Iron Paradise Gym"""
    
    def __init__(self):
        self.merchant_key = os.environ.get('PAYU_MERCHANT_KEY')
        self.merchant_salt = os.environ.get('PAYU_SALT') 
        self.base_url = os.environ.get('PAYU_BASE_URL', 'https://test.payu.in')
        
        if not self.merchant_key or not self.merchant_salt:
            logger.warning("PayU credentials not configured")
            
        logger.info(f"PayU Service initialized with base URL: {self.base_url}")
    
    def generate_transaction_id(self) -> str:
        """Generate unique transaction ID"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8].upper()
        return f"PAYU_{timestamp}_{unique_id}"
    
    def generate_payment_hash(self, params: Dict[str, Any]) -> str:
        """Generate payment hash for PayU request"""
        try:
            # PayU hash string format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt
            hash_string = (
                f"{self.merchant_key}|{params['txnid']}|{params['amount']}|"
                f"{params['productinfo']}|{params['firstname']}|{params['email']}|"
                f"{params.get('udf1', '')}|{params.get('udf2', '')}|{params.get('udf3', '')}|"
                f"{params.get('udf4', '')}|{params.get('udf5', '')}||||||{self.merchant_salt}"
            )
            
            return hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
            
        except Exception as e:
            logger.error(f"Hash generation error: {e}")
            raise
    
    def create_payment_request(self, payment_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create payment request with PayU"""
        try:
            if not self.merchant_key or not self.merchant_salt:
                raise Exception("PayU credentials not configured")
                
            txnid = self.generate_transaction_id()
            
            # Base URL from environment
            base_url = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001')
            
            params = {
                "key": self.merchant_key,
                "txnid": txnid,
                "amount": str(payment_data["amount"]),
                "productinfo": payment_data["product_info"],
                "firstname": payment_data["customer_name"],
                "email": payment_data["customer_email"],
                "phone": payment_data.get("customer_phone", ""),
                "surl": f"{base_url}/api/payu/success",
                "furl": f"{base_url}/api/payu/failure",
                "service_provider": "payu_paisa"
            }
            
            # Add UDF fields for additional data
            params["udf1"] = payment_data.get("member_id", "")
            params["udf2"] = payment_data.get("membership_type", "")
            params["udf3"] = payment_data.get("payment_for", "membership")
            params["udf4"] = payment_data.get("gym_branch", "main")
            params["udf5"] = payment_data.get("discount_code", "")
            
            # Generate hash
            params["hash"] = self.generate_payment_hash(params)
            
            return {
                "status": "success",
                "payment_url": f"{self.base_url}/_payment",
                "params": params,
                "txnid": txnid,
                "gateway": "payu"
            }
            
        except Exception as e:
            logger.error(f"PayU payment request creation failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "gateway": "payu"
            }
    
    def verify_payment(self, txnid: str) -> Dict[str, Any]:
        """Verify payment status using transaction ID"""
        try:
            if not self.merchant_key or not self.merchant_salt:
                raise Exception("PayU credentials not configured")
                
            # Generate verification hash
            verify_hash = self.generate_verify_hash(txnid)
            
            # Verification parameters
            params = {
                "key": self.merchant_key,
                "command": "verify_payment",
                "var1": txnid,
                "hash": verify_hash
            }
            
            # Make verification request
            verify_url = f"{self.base_url}/merchant/postservice?form=2"
            response = requests.post(verify_url, data=params, timeout=30)
            
            if response.status_code == 200:
                response_data = response.json()
                
                return {
                    "status": "success",
                    "verification_data": response_data,
                    "gateway": "payu"
                }
            else:
                return {
                    "status": "error",
                    "error": f"Verification failed with status: {response.status_code}",
                    "gateway": "payu"
                }
                
        except Exception as e:
            logger.error(f"PayU payment verification failed: {e}")
            return {
                "status": "error",
                "error": str(e),
                "gateway": "payu"
            }
    
    def generate_verify_hash(self, txnid: str) -> str:
        """Generate hash for payment verification"""
        hash_string = f"{self.merchant_key}|verify_payment|{txnid}|{self.merchant_salt}"
        return hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
    
    def verify_response_hash(self, response_params: Dict[str, Any]) -> bool:
        """Verify PayU response hash"""
        try:
            received_hash = response_params.get("hash", "")
            if not received_hash:
                return False
            
            # Generate expected hash for response
            # Response hash format: salt|status|||||||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
            hash_string = (
                f"{self.merchant_salt}|{response_params.get('status', '')}|||||||||||"
                f"{response_params.get('udf5', '')}|{response_params.get('udf4', '')}|"
                f"{response_params.get('udf3', '')}|{response_params.get('udf2', '')}|"
                f"{response_params.get('udf1', '')}|{response_params.get('email', '')}|"
                f"{response_params.get('firstname', '')}|{response_params.get('productinfo', '')}|"
                f"{response_params.get('amount', '')}|{response_params.get('txnid', '')}|{self.merchant_key}"
            )
            
            expected_hash = hashlib.sha512(hash_string.encode('utf-8')).hexdigest()
            
            return received_hash.lower() == expected_hash.lower()
            
        except Exception as e:
            logger.error(f"Response hash verification error: {e}")
            return False
    
    def get_supported_payment_methods(self) -> List[str]:
        """Get list of supported payment methods"""
        return [
            "credit_card",
            "debit_card", 
            "net_banking",
            "upi",
            "paytm_wallet",
            "phonepe",
            "gpay",
            "mobikwik",
            "freecharge",
            "emi"
        ]
    
    def get_gateway_info(self) -> Dict[str, Any]:
        """Get PayU gateway information"""
        return {
            "name": "PayU",
            "gateway_id": "payu", 
            "supported_methods": self.get_supported_payment_methods(),
            "supports_refunds": True,
            "supports_partial_refunds": True,
            "currency": "INR",
            "min_amount": 1.00,
            "max_amount": 999999.99,
            "test_mode": "test" in self.base_url.lower()
        }

# Global instance
payu_service_instance = None

def initialize_payu_service():
    """Initialize PayU service"""
    global payu_service_instance
    try:
        payu_service_instance = PayUService()
        logger.info("PayU service initialized successfully")
        return payu_service_instance
    except Exception as e:
        logger.error(f"Failed to initialize PayU service: {e}")
        return None

def get_payu_service():
    """Get the global PayU service instance"""
    return payu_service_instance