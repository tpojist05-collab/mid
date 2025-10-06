#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, List

class IronParadiseGymAPITester:
    def __init__(self, base_url="https://gymflow-59.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_member_id = None
        self.created_payment_id = None
        self.auth_token = None
        self.admin_user = None
        self.created_template_id = None

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")
        if not success and response_data:
            print(f"    Response: {response_data}")
        print()

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200, auth_required: bool = False) -> tuple:
        """Make HTTP request and return success status and response"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        # Add authorization header if auth is required and token is available
        if auth_required and self.auth_token:
            headers['Authorization'] = f"Bearer {self.auth_token}"
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"status_code": response.status_code, "text": response.text}
                
            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.make_request('GET', '')
        expected_message = "Iron Paradise Gym Management API"
        
        if success and response.get('message') == expected_message:
            self.log_test("Root Endpoint", True, "API is accessible and responding correctly")
        else:
            self.log_test("Root Endpoint", False, f"Expected message '{expected_message}', got: {response}")

    def test_authentication_login(self):
        """Test authentication with test credentials"""
        login_data = {
            "username": "test_admin",
            "password": "TestPass123!"
        }
        
        # Use form data for OAuth2PasswordRequestForm
        success, response = self.make_request('POST', 'auth/login', login_data)
        
        if success:
            required_fields = ['access_token', 'token_type', 'user']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                self.auth_token = response['access_token']
                self.admin_user = response['user']
                user_role = self.admin_user.get('role')
                
                if user_role == 'admin':
                    self.log_test("Authentication Login", True, f"Successfully logged in as admin: {self.admin_user.get('username')}")
                else:
                    self.log_test("Authentication Login", False, f"Expected admin role, got: {user_role}")
            else:
                self.log_test("Authentication Login", False, f"Missing required fields: {missing_fields}", response)
        else:
            self.log_test("Authentication Login", False, "Failed to authenticate with test credentials", response)

    def test_jwt_token_validation(self):
        """Test JWT token validation"""
        if not self.auth_token:
            self.log_test("JWT Token Validation", False, "No auth token available for testing")
            return
            
        success, response = self.make_request('GET', 'auth/me', auth_required=True)
        
        if success:
            if response.get('username') == 'test_admin' and response.get('role') == 'admin':
                self.log_test("JWT Token Validation", True, "JWT token is valid and returns correct user info")
            else:
                self.log_test("JWT Token Validation", False, "JWT token validation returned incorrect user data", response)
        else:
            self.log_test("JWT Token Validation", False, "JWT token validation failed", response)

    def test_unauthorized_access(self):
        """Test unauthorized access to protected endpoints"""
        # Try to access admin endpoint without token
        success, response = self.make_request('GET', 'users', expected_status=401)
        
        if success:  # success here means we got the expected 401 status
            self.log_test("Unauthorized Access Protection", True, "Protected endpoint correctly returns 401 without token")
        else:
            self.log_test("Unauthorized Access Protection", False, "Protected endpoint should return 401 without token", response)

    def test_payment_gateways_initialization(self):
        """Test payment gateways initialization and configuration"""
        success, response = self.make_request('GET', 'payment-gateways', auth_required=True)
        
        if success:
            if isinstance(response, list):
                expected_gateways = ['razorpay', 'payu', 'google_pay', 'paytm', 'phonepe']
                found_gateways = [gw.get('provider') for gw in response]
                
                missing_gateways = [gw for gw in expected_gateways if gw not in found_gateways]
                
                if not missing_gateways:
                    enabled_count = sum(1 for gw in response if gw.get('is_enabled', False))
                    self.log_test("Payment Gateways Initialization", True, 
                                f"All 5 payment gateways found, {enabled_count} enabled: {found_gateways}")
                else:
                    self.log_test("Payment Gateways Initialization", False, 
                                f"Missing gateways: {missing_gateways}, found: {found_gateways}")
            else:
                self.log_test("Payment Gateways Initialization", False, "Expected list response for payment gateways", response)
        else:
            self.log_test("Payment Gateways Initialization", False, "Failed to get payment gateways", response)

    def test_receipt_templates_system(self):
        """Test receipt template system"""
        if not self.auth_token:
            self.log_test("Receipt Templates System", False, "No auth token available for testing")
            return
            
        # Test getting receipt templates (admin only)
        success, response = self.make_request('GET', 'receipts/templates', auth_required=True)
        
        if success:
            if isinstance(response, list):
                default_template = next((t for t in response if t.get('is_default')), None)
                
                if default_template:
                    template_id = default_template.get('id')
                    self.log_test("Receipt Templates System", True, 
                                f"Found {len(response)} templates, default template ID: {template_id}")
                    
                    # Test getting specific template
                    self.test_specific_receipt_template(template_id)
                else:
                    self.log_test("Receipt Templates System", False, "No default template found", response)
            else:
                self.log_test("Receipt Templates System", False, "Expected list response for templates", response)
        else:
            self.log_test("Receipt Templates System", False, "Failed to get receipt templates", response)

    def test_specific_receipt_template(self, template_id: str):
        """Test getting a specific receipt template"""
        success, response = self.make_request('GET', f'receipts/templates/{template_id}', auth_required=True)
        
        if success:
            required_fields = ['id', 'name', 'template_type', 'header', 'styles', 'sections', 'footer']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                self.log_test("Specific Receipt Template", True, f"Template retrieved with all required fields")
            else:
                self.log_test("Specific Receipt Template", False, f"Missing template fields: {missing_fields}")
        else:
            self.log_test("Specific Receipt Template", False, "Failed to get specific template", response)

    def test_receipt_template_crud(self):
        """Test receipt template CRUD operations"""
        if not self.auth_token:
            self.log_test("Receipt Template CRUD", False, "No auth token available for testing")
            return
            
        # Create new template
        template_data = {
            "name": "Test Receipt Template",
            "is_default": False,
            "template_type": "payment_receipt",
            "header": {
                "gym_name": "Test Gym",
                "address": "Test Address"
            },
            "styles": {
                "primary_color": "#000000"
            },
            "sections": {
                "show_payment_details": True,
                "show_member_info": True
            },
            "footer": {
                "thank_you_message": "Thank you for testing!"
            }
        }
        
        success, response = self.make_request('POST', 'receipts/templates', template_data, auth_required=True)
        
        if success:
            template_id = response.get('template_id')
            if template_id:
                self.created_template_id = template_id
                self.log_test("Create Receipt Template", True, f"Template created with ID: {template_id}")
                
                # Test update
                self.test_update_receipt_template(template_id)
            else:
                self.log_test("Create Receipt Template", False, "No template ID returned", response)
        else:
            self.log_test("Create Receipt Template", False, "Failed to create template", response)

    def test_update_receipt_template(self, template_id: str):
        """Test updating a receipt template"""
        update_data = {
            "name": "Updated Test Template",
            "header": {
                "gym_name": "Updated Test Gym"
            }
        }
        
        success, response = self.make_request('PUT', f'receipts/templates/{template_id}', update_data, auth_required=True)
        
        if success:
            self.log_test("Update Receipt Template", True, "Template updated successfully")
        else:
            self.log_test("Update Receipt Template", False, "Failed to update template", response)

    def test_create_member(self):
        """Test creating a new member"""
        member_data = {
            "name": "Test Member",
            "email": "test@example.com",
            "phone": "+91 9876543210",
            "address": "123 Test Street, Test City, Test State 123456",
            "emergency_contact": {
                "name": "Emergency Contact",
                "phone": "+91 9876543211",
                "relationship": "Spouse"
            },
            "membership_type": "monthly"
        }
        
        success, response = self.make_request('POST', 'members', member_data, 200)
        
        if success:
            # Validate response structure
            required_fields = ['id', 'name', 'email', 'phone', 'membership_type', 'total_amount_due']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                self.created_member_id = response['id']
                expected_total = 3500.0  # 2000 + 1500 admission fee
                actual_total = response.get('total_amount_due', 0)
                
                if actual_total == expected_total:
                    self.log_test("Create Member", True, f"Member created with ID: {self.created_member_id}")
                else:
                    self.log_test("Create Member", False, f"Expected total_amount_due: {expected_total}, got: {actual_total}")
            else:
                self.log_test("Create Member", False, f"Missing required fields: {missing_fields}", response)
        else:
            self.log_test("Create Member", False, "Failed to create member", response)

    def test_get_members(self):
        """Test getting all members"""
        success, response = self.make_request('GET', 'members')
        
        if success:
            if isinstance(response, list):
                member_count = len(response)
                self.log_test("Get All Members", True, f"Retrieved {member_count} members")
                
                # Check if our created member is in the list
                if self.created_member_id:
                    member_found = any(member.get('id') == self.created_member_id for member in response)
                    if member_found:
                        self.log_test("Verify Created Member in List", True, "Created member found in members list")
                    else:
                        self.log_test("Verify Created Member in List", False, "Created member not found in members list")
            else:
                self.log_test("Get All Members", False, "Expected list response", response)
        else:
            self.log_test("Get All Members", False, "Failed to get members", response)

    def test_get_specific_member(self):
        """Test getting a specific member by ID"""
        if not self.created_member_id:
            self.log_test("Get Specific Member", False, "No member ID available for testing")
            return
            
        success, response = self.make_request('GET', f'members/{self.created_member_id}')
        
        if success:
            if response.get('id') == self.created_member_id:
                self.log_test("Get Specific Member", True, f"Retrieved member: {response.get('name')}")
            else:
                self.log_test("Get Specific Member", False, "Member ID mismatch", response)
        else:
            self.log_test("Get Specific Member", False, "Failed to get specific member", response)

    def test_update_member(self):
        """Test updating a member"""
        if not self.created_member_id:
            self.log_test("Update Member", False, "No member ID available for testing")
            return
            
        update_data = {
            "name": "Updated Test Member",
            "email": "updated@example.com",
            "phone": "+91 9876543210",
            "address": "456 Updated Street, Updated City, Updated State 654321",
            "emergency_contact": {
                "name": "Updated Emergency Contact",
                "phone": "+91 9876543211",
                "relationship": "Parent"
            },
            "membership_type": "quarterly"
        }
        
        success, response = self.make_request('PUT', f'members/{self.created_member_id}', update_data)
        
        if success:
            if response.get('name') == "Updated Test Member" and response.get('membership_type') == "quarterly":
                expected_total = 7000.0  # 5500 + 1500 admission fee
                actual_total = response.get('total_amount_due', 0)
                if actual_total == expected_total:
                    self.log_test("Update Member", True, "Member updated successfully with correct pricing")
                else:
                    self.log_test("Update Member", False, f"Expected total_amount_due: {expected_total}, got: {actual_total}")
            else:
                self.log_test("Update Member", False, "Member update data mismatch", response)
        else:
            self.log_test("Update Member", False, "Failed to update member", response)

    def test_record_payment(self):
        """Test recording a payment"""
        if not self.created_member_id:
            self.log_test("Record Payment", False, "No member ID available for testing")
            return
            
        payment_data = {
            "member_id": self.created_member_id,
            "amount": 3500.0,
            "payment_method": "cash",
            "description": "Monthly membership fee + admission fee",
            "transaction_id": "TEST_TXN_001"
        }
        
        success, response = self.make_request('POST', 'payments', payment_data)
        
        if success:
            required_fields = ['id', 'member_id', 'amount', 'payment_method', 'description']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                self.created_payment_id = response['id']
                self.log_test("Record Payment", True, f"Payment recorded with ID: {self.created_payment_id}")
            else:
                self.log_test("Record Payment", False, f"Missing required fields: {missing_fields}", response)
        else:
            self.log_test("Record Payment", False, "Failed to record payment", response)

    def test_get_all_payments(self):
        """Test getting all payments"""
        success, response = self.make_request('GET', 'payments')
        
        if success:
            if isinstance(response, list):
                payment_count = len(response)
                self.log_test("Get All Payments", True, f"Retrieved {payment_count} payments")
                
                # Check if our created payment is in the list
                if self.created_payment_id:
                    payment_found = any(payment.get('id') == self.created_payment_id for payment in response)
                    if payment_found:
                        self.log_test("Verify Created Payment in List", True, "Created payment found in payments list")
                    else:
                        self.log_test("Verify Created Payment in List", False, "Created payment not found in payments list")
            else:
                self.log_test("Get All Payments", False, "Expected list response", response)
        else:
            self.log_test("Get All Payments", False, "Failed to get payments", response)

    def test_get_member_payments(self):
        """Test getting payments for a specific member"""
        if not self.created_member_id:
            self.log_test("Get Member Payments", False, "No member ID available for testing")
            return
            
        success, response = self.make_request('GET', f'payments/{self.created_member_id}')
        
        if success:
            if isinstance(response, list):
                payment_count = len(response)
                self.log_test("Get Member Payments", True, f"Retrieved {payment_count} payments for member")
            else:
                self.log_test("Get Member Payments", False, "Expected list response", response)
        else:
            self.log_test("Get Member Payments", False, "Failed to get member payments", response)

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        success, response = self.make_request('GET', 'dashboard/stats')
        
        if success:
            required_fields = ['total_members', 'active_members', 'pending_members', 'monthly_revenue']
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                stats_summary = {
                    'total_members': response.get('total_members', 0),
                    'active_members': response.get('active_members', 0),
                    'pending_members': response.get('pending_members', 0),
                    'monthly_revenue': response.get('monthly_revenue', 0)
                }
                self.log_test("Dashboard Stats", True, f"Stats: {stats_summary}")
            else:
                self.log_test("Dashboard Stats", False, f"Missing required fields: {missing_fields}", response)
        else:
            self.log_test("Dashboard Stats", False, "Failed to get dashboard stats", response)

    def test_expiring_members(self):
        """Test getting expiring members"""
        success, response = self.make_request('GET', 'members/expiring-soon?days=7')
        
        if success:
            if isinstance(response, list):
                expiring_count = len(response)
                self.log_test("Get Expiring Members", True, f"Retrieved {expiring_count} expiring members")
            else:
                self.log_test("Get Expiring Members", False, "Expected list response", response)
        else:
            self.log_test("Get Expiring Members", False, "Failed to get expiring members", response)

    def test_membership_pricing(self):
        """Test membership pricing calculations"""
        pricing_tests = [
            {"type": "monthly", "expected_fee": 2000.0, "expected_total": 3500.0},
            {"type": "quarterly", "expected_fee": 5500.0, "expected_total": 7000.0},
            {"type": "six_monthly", "expected_fee": 10500.0, "expected_total": 12000.0}
        ]
        
        all_passed = True
        for test in pricing_tests:
            member_data = {
                "name": f"Pricing Test {test['type']}",
                "email": f"pricing_{test['type']}@example.com",
                "phone": "+91 9876543299",
                "address": "Test Address",
                "emergency_contact": {
                    "name": "Test Contact",
                    "phone": "+91 9876543298",
                    "relationship": "Friend"
                },
                "membership_type": test['type']
            }
            
            success, response = self.make_request('POST', 'members', member_data)
            
            if success:
                actual_fee = response.get('monthly_fee_amount', 0)
                actual_total = response.get('total_amount_due', 0)
                
                if actual_fee == test['expected_fee'] and actual_total == test['expected_total']:
                    continue
                else:
                    all_passed = False
                    break
            else:
                all_passed = False
                break
        
        if all_passed:
            self.log_test("Membership Pricing", True, "All membership types have correct pricing")
        else:
            self.log_test("Membership Pricing", False, "Pricing calculation errors found")

    def run_all_tests(self):
        """Run all API tests"""
        print("🏋️ Starting Gym Membership API Tests")
        print("=" * 50)
        
        # Test sequence
        self.test_root_endpoint()
        self.test_create_member()
        self.test_get_members()
        self.test_get_specific_member()
        self.test_update_member()
        self.test_record_payment()
        self.test_get_all_payments()
        self.test_get_member_payments()
        self.test_dashboard_stats()
        self.test_expiring_members()
        self.test_membership_pricing()
        
        # Print summary
        print("=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            failed_tests = [test for test in self.test_results if not test['success']]
            print("\nFailed tests:")
            for test in failed_tests:
                print(f"  - {test['test_name']}: {test['details']}")
            return 1

def main():
    tester = GymMembershipAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())