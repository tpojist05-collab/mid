#!/usr/bin/env python3
"""
Test the API endpoint for member expiry functionality
"""
import requests
import json

def test_member_api():
    """Test the member API endpoints"""
    
    base_url = "http://localhost:8001/api"
    
    print("🧪 Testing Member API Endpoints")
    print("=" * 50)
    
    # Test login first to get authentication token
    print("\n🔐 Testing Authentication...")
    
    login_data = {
        "username": "goswami",
        "password": "admin123"
    }
    
    try:
        # Login
        login_response = requests.post(
            f"{base_url}/auth/login",
            data=login_data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if login_response.status_code == 200:
            token_data = login_response.json()
            token = token_data["access_token"]
            print("   ✅ Authentication successful")
            
            # Test different member status endpoints
            headers = {"Authorization": f"Bearer {token}"}
            
            test_cases = [
                ("", "All members"),
                ("?status=expired", "Expired members"),
                ("?status=active", "Active members"),
                ("?status=expiring_7days", "Members expiring in 7 days"),
                ("?status=expiring_30days", "Members expiring in 30 days"),
                ("?status=pending", "Pending members"),
                ("?status=inactive", "Inactive members")
            ]
            
            print(f"\n📋 Testing Member Endpoints...")
            
            for query_param, description in test_cases:
                try:
                    response = requests.get(
                        f"{base_url}/members{query_param}",
                        headers=headers
                    )
                    
                    if response.status_code == 200:
                        members = response.json()
                        print(f"   ✅ {description}: {len(members)} members found")
                        
                        # Show sample member if any
                        if members:
                            sample = members[0]
                            print(f"      Sample: {sample.get('name', 'Unknown')} - Status: {sample.get('current_payment_status', 'Unknown')}")
                    else:
                        print(f"   ❌ {description}: Error {response.status_code}")
                        
                except Exception as e:
                    print(f"   ❌ {description}: Exception - {e}")
            
            print(f"\n✅ API endpoint testing completed!")
            
        else:
            print(f"   ❌ Authentication failed: {login_response.status_code}")
            print(f"   Response: {login_response.text}")
            
    except Exception as e:
        print(f"❌ Error during API testing: {e}")

if __name__ == "__main__":
    test_member_api()