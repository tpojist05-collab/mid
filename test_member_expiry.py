#!/usr/bin/env python3
"""
Test script to verify member expiry logic implementation
"""
import asyncio
import sys
import os
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.append('/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
from server import parse_from_mongo

async def test_member_expiry_logic():
    """Test the member expiry logic"""
    
    # Connect to MongoDB
    mongo_url = "mongodb://localhost:27017"
    client = AsyncIOMotorClient(mongo_url)
    db = client["test_database"]
    
    try:
        # Get current time
        current_time = datetime.now(timezone.utc)
        
        # Test different status filters
        test_cases = [
            ("active", "Active members (paid and not expired)"),
            ("expired", "Expired members"),
            ("expiring_7days", "Members expiring within 7 days"),
            ("expiring_30days", "Members expiring within 30 days"),
            ("inactive", "Inactive members"),
            ("pending", "Pending members")
        ]
        
        print("🧪 Testing Member Expiry Logic")
        print("=" * 50)
        
        for status, description in test_cases:
            print(f"\n📋 Testing: {description}")
            
            # Build query based on status (same logic as in server.py)
            query = {}
            
            if status == "active":
                query["$and"] = [
                    {"current_payment_status": {"$in": ["paid", "active"]}},
                    {"membership_end": {"$gt": current_time.isoformat()}}
                ]
            elif status == "expired":
                query["membership_end"] = {"$lt": current_time.isoformat()}
            elif status == "expiring_7days":
                seven_days_from_now = current_time + timedelta(days=7)
                query["$and"] = [
                    {"membership_end": {"$gt": current_time.isoformat()}},
                    {"membership_end": {"$lte": seven_days_from_now.isoformat()}}
                ]
            elif status == "expiring_30days":
                thirty_days_from_now = current_time + timedelta(days=30)
                query["$and"] = [
                    {"membership_end": {"$gt": current_time.isoformat()}},
                    {"membership_end": {"$lte": thirty_days_from_now.isoformat()}}
                ]
            elif status == "inactive":
                query["current_payment_status"] = {"$in": ["unpaid", "inactive", "suspended"]}
            elif status == "pending":
                query["current_payment_status"] = "pending"
            
            # Execute query
            members = await db.members.find(query).to_list(1000)
            
            print(f"   Query: {query}")
            print(f"   Found: {len(members)} members")
            
            # Show sample member details if any found
            if members:
                sample = members[0]
                member_obj = parse_from_mongo(sample)
                print(f"   Sample member: {member_obj.get('name', 'Unknown')}")
                print(f"   Payment status: {member_obj.get('current_payment_status', 'Unknown')}")
                print(f"   Membership end: {member_obj.get('membership_end', 'Unknown')}")
                
                # Check if expired
                if member_obj.get('membership_end'):
                    membership_end = member_obj['membership_end']
                    if isinstance(membership_end, str):
                        membership_end = datetime.fromisoformat(membership_end)
                    is_expired = membership_end < current_time
                    print(f"   Is expired: {is_expired}")
        
        # Test the expiry update logic
        print(f"\n🔄 Testing Expiry Update Logic")
        print("=" * 50)
        
        # Get all members
        all_members = await db.members.find({}).to_list(1000)
        expired_count = 0
        
        for member in all_members:
            member_obj = parse_from_mongo(member)
            
            # Check if member is expired
            if member_obj.get('membership_end'):
                membership_end = datetime.fromisoformat(member_obj['membership_end'])
                if membership_end < current_time:
                    current_status = member_obj.get('current_payment_status', '')
                    if current_status != 'expired':
                        print(f"   Would update {member_obj.get('name', 'Unknown')} to expired status")
                        expired_count += 1
        
        print(f"   Total members that would be updated to expired: {expired_count}")
        
        print(f"\n✅ Member expiry logic test completed successfully!")
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_member_expiry_logic())