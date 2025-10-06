from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
import razorpay
from reminder_service import init_reminder_service, get_reminder_service
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, HTTPException, status

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Razorpay client
razorpay_client = razorpay.Client(auth=(os.environ['RAZORPAY_KEY_ID'], os.environ['RAZORPAY_KEY_SECRET']))

# Create the main app without a prefix
app = FastAPI(title="Iron Paradise Gym Management System")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Initialize reminder service
reminder_service_instance = None

# Enums
class MembershipType(str, Enum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SIX_MONTHLY = "six_monthly"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    OVERDUE = "overdue"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    UPI = "upi"
    RAZORPAY = "razorpay"

# Models
class EmergencyContact(BaseModel):
    name: str
    phone: str
    relationship: str

class MemberCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    address: str
    emergency_contact: EmergencyContact
    membership_type: MembershipType
    join_date: Optional[datetime] = None

class Member(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: EmailStr
    phone: str
    address: str
    emergency_contact: EmergencyContact
    membership_type: MembershipType
    join_date: datetime
    membership_start: datetime
    membership_end: datetime
    admission_fee_paid: bool = False
    current_payment_status: PaymentStatus = PaymentStatus.PENDING
    total_amount_due: float
    admission_fee_amount: float = 1500.0
    monthly_fee_amount: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    amount: float
    payment_method: PaymentMethod
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    description: str
    transaction_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None

class PaymentCreate(BaseModel):
    member_id: str
    amount: float
    payment_method: PaymentMethod
    description: str
    transaction_id: Optional[str] = None

class RazorpayOrderCreate(BaseModel):
    member_id: str
    amount: float
    currency: str = "INR"
    description: str

class RazorpayOrderResponse(BaseModel):
    order_id: str
    amount: float
    currency: str
    key_id: str

class RazorpayPaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    member_id: str
    description: str

# Helper functions
def calculate_membership_fee(membership_type: MembershipType) -> float:
    """Calculate membership fee based on type"""
    rates = {
        MembershipType.MONTHLY: 2000.0,
        MembershipType.QUARTERLY: 5500.0,  # 3 months with discount
        MembershipType.SIX_MONTHLY: 10500.0  # 6 months with discount
    }
    return rates.get(membership_type, 2000.0)

def calculate_membership_end_date(start_date: datetime, membership_type: MembershipType) -> datetime:
    """Calculate membership end date based on type"""
    duration_days = {
        MembershipType.MONTHLY: 30,
        MembershipType.QUARTERLY: 90,
        MembershipType.SIX_MONTHLY: 180
    }
    days = duration_days.get(membership_type, 30)
    return start_date + timedelta(days=days)

def prepare_for_mongo(data: dict) -> dict:
    """Prepare data for MongoDB storage"""
    for key, value in data.items():
        if isinstance(value, datetime):
            data[key] = value.isoformat()
    return data

def parse_from_mongo(item: dict) -> dict:
    """Parse data from MongoDB"""
    datetime_fields = ['join_date', 'membership_start', 'membership_end', 'created_at', 'updated_at', 'payment_date']
    for field in datetime_fields:
        if field in item and isinstance(item[field], str):
            item[field] = datetime.fromisoformat(item[field])
        elif field in item and item[field] is None:
            # Handle None values by setting a default datetime for required fields
            if field in ['join_date', 'membership_start', 'membership_end', 'created_at', 'updated_at']:
                item[field] = datetime.now(timezone.utc)
    return item

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Iron Paradise Gym Management API"}

# Member Management Routes
@api_router.post("/members", response_model=Member)
async def create_member(member_data: MemberCreate):
    try:
        # Set join date if not provided
        join_date = member_data.join_date or datetime.now(timezone.utc)
        
        # Calculate membership details
        monthly_fee = calculate_membership_fee(member_data.membership_type)
        membership_end = calculate_membership_end_date(join_date, member_data.membership_type)
        
        # Calculate total amount due (admission fee + membership fee)
        total_due = 1500.0 + monthly_fee
        
        member = Member(
            **member_data.dict(exclude={'join_date'}),
            join_date=join_date,
            membership_start=join_date,
            membership_end=membership_end,
            monthly_fee_amount=monthly_fee,
            total_amount_due=total_due
        )
        
        # Prepare for MongoDB storage
        member_dict = prepare_for_mongo(member.dict())
        await db.members.insert_one(member_dict)
        
        return member
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/members", response_model=List[Member])
async def get_members():
    try:
        members = await db.members.find().to_list(1000)
        return [Member(**parse_from_mongo(member)) for member in members]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Members expiring soon - MUST be before /members/{member_id} route
@api_router.get("/members/expiring-soon", response_model=List[Member])
async def get_expiring_members(days: int = 7):
    try:
        expiry_date = datetime.now(timezone.utc) + timedelta(days=days)
        members = await db.members.find({
            "membership_end": {"$lte": expiry_date.isoformat()}
        }).to_list(1000)
        
        if not members:
            return []
            
        # Parse members carefully
        parsed_members = []
        for member in members:
            try:
                parsed_member = parse_from_mongo(member)
                parsed_members.append(Member(**parsed_member))
            except Exception as member_error:
                logger.error(f"Error parsing member {member.get('id', 'unknown')}: {member_error}")
                continue
                
        return parsed_members
    except Exception as e:
        logger.error(f"Error fetching expiring members: {e}")
        return []  # Return empty list instead of raising exception

@api_router.get("/members/{member_id}", response_model=Member)
async def get_member(member_id: str):
    try:
        member = await db.members.find_one({"id": member_id})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        return Member(**parse_from_mongo(member))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/members/{member_id}", response_model=Member)
async def update_member(member_id: str, member_update: MemberCreate):
    try:
        existing_member = await db.members.find_one({"id": member_id})
        if not existing_member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Update member data
        update_data = member_update.dict()
        update_data['updated_at'] = datetime.now(timezone.utc)
        
        # Preserve existing join_date if not provided in update
        if update_data.get('join_date') is None:
            update_data['join_date'] = existing_member.get('join_date')
        
        # If membership type changed, recalculate fees
        if update_data['membership_type'] != existing_member['membership_type']:
            monthly_fee = calculate_membership_fee(member_update.membership_type)
            update_data['monthly_fee_amount'] = monthly_fee
            update_data['total_amount_due'] = 1500.0 + monthly_fee
        
        # Prepare for MongoDB
        update_data = prepare_for_mongo(update_data)
        
        await db.members.update_one(
            {"id": member_id},
            {"$set": update_data}
        )
        
        # Get updated member
        updated_member = await db.members.find_one({"id": member_id})
        return Member(**parse_from_mongo(updated_member))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Payment Management Routes
@api_router.post("/payments", response_model=PaymentRecord)
async def record_payment(payment_data: PaymentCreate):
    try:
        # Check if member exists
        member = await db.members.find_one({"id": payment_data.member_id})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Create payment record
        payment = PaymentRecord(**payment_data.dict())
        payment_dict = prepare_for_mongo(payment.dict())
        await db.payments.insert_one(payment_dict)
        
        # Update member payment status
        await db.members.update_one(
            {"id": payment_data.member_id},
            {"$set": {
                "current_payment_status": PaymentStatus.PAID.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return payment
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/payments/{member_id}", response_model=List[PaymentRecord])
async def get_member_payments(member_id: str):
    try:
        payments = await db.payments.find({"member_id": member_id}).to_list(1000)
        return [PaymentRecord(**parse_from_mongo(payment)) for payment in payments]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/payments", response_model=List[PaymentRecord])
async def get_all_payments():
    try:
        payments = await db.payments.find().sort("payment_date", -1).to_list(1000)
        return [PaymentRecord(**parse_from_mongo(payment)) for payment in payments]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Dashboard Stats Route
@api_router.get("/dashboard/stats")
async def get_dashboard_stats():
    try:
        total_members = await db.members.count_documents({})
        active_members = await db.members.count_documents({"current_payment_status": "paid"})
        pending_members = await db.members.count_documents({"current_payment_status": "pending"})
        overdue_members = await db.members.count_documents({"current_payment_status": "overdue"})
        
        # Calculate expiring memberships (next 7 days)
        next_week = datetime.now(timezone.utc) + timedelta(days=7)
        expiring_soon = await db.members.count_documents({
            "membership_end": {"$lte": next_week.isoformat()},
            "current_payment_status": {"$ne": "expired"}
        })
        
        # Calculate total revenue this month
        start_of_month = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0)
        monthly_payments = await db.payments.find({
            "payment_date": {"$gte": start_of_month.isoformat()}
        }).to_list(1000)
        
        monthly_revenue = sum(payment.get('amount', 0) for payment in monthly_payments)
        
        return {
            "total_members": total_members,
            "active_members": active_members,
            "pending_members": pending_members,
            "overdue_members": overdue_members,
            "expiring_soon": expiring_soon,
            "monthly_revenue": monthly_revenue
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Razorpay Payment Routes
@api_router.post("/razorpay/create-order", response_model=RazorpayOrderResponse)
async def create_razorpay_order(order_data: RazorpayOrderCreate):
    try:
        # Verify member exists
        member = await db.members.find_one({"id": order_data.member_id})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Convert amount to paise (Razorpay expects amount in smallest currency unit)
        amount_in_paise = int(order_data.amount * 100)
        
        # Create Razorpay order
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": order_data.currency,
            "payment_capture": 1,
            "notes": {
                "member_id": order_data.member_id,
                "member_name": member.get("name", ""),
                "description": order_data.description
            }
        })
        
        # Store order in database
        order_record = {
            "order_id": razorpay_order["id"],
            "member_id": order_data.member_id,
            "amount": order_data.amount,
            "amount_in_paise": amount_in_paise,
            "currency": order_data.currency,
            "description": order_data.description,
            "status": "created",
            "created_at": datetime.now(timezone.utc)
        }
        
        await db.razorpay_orders.insert_one(order_record)
        
        return RazorpayOrderResponse(
            order_id=razorpay_order["id"],
            amount=amount_in_paise,
            currency=order_data.currency,
            key_id=os.environ['RAZORPAY_KEY_ID']
        )
        
    except Exception as e:
        logger.error(f"Error creating Razorpay order: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/razorpay/verify-payment")
async def verify_razorpay_payment(payment_data: RazorpayPaymentVerify):
    try:
        # Verify payment signature
        params_dict = {
            'razorpay_order_id': payment_data.razorpay_order_id,
            'razorpay_payment_id': payment_data.razorpay_payment_id,
            'razorpay_signature': payment_data.razorpay_signature
        }
        
        try:
            razorpay_client.utility.verify_payment_signature(params_dict)
        except Exception as e:
            logger.error(f"Payment signature verification failed: {e}")
            raise HTTPException(status_code=400, detail="Payment signature verification failed")
        
        # Get order details
        order = await db.razorpay_orders.find_one({"order_id": payment_data.razorpay_order_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        # Create payment record
        payment_record = PaymentRecord(
            member_id=payment_data.member_id,
            amount=order["amount"],
            payment_method=PaymentMethod.RAZORPAY,
            description=payment_data.description,
            razorpay_payment_id=payment_data.razorpay_payment_id
        )
        
        # Save payment
        payment_dict = prepare_for_mongo(payment_record.dict())
        await db.payments.insert_one(payment_dict)
        
        # Update member payment status
        await db.members.update_one(
            {"id": payment_data.member_id},
            {"$set": {
                "current_payment_status": PaymentStatus.PAID.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update order status
        await db.razorpay_orders.update_one(
            {"order_id": payment_data.razorpay_order_id},
            {"$set": {
                "status": "paid",
                "payment_id": payment_data.razorpay_payment_id,
                "paid_at": datetime.now(timezone.utc)
            }}
        )
        
        return {"status": "success", "message": "Payment verified and recorded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error verifying payment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/razorpay/key")
async def get_razorpay_key():
    """Get Razorpay public key for frontend"""
    return {"key_id": os.environ['RAZORPAY_KEY_ID']}

# Reminder Service Routes
@api_router.post("/reminders/send/{member_id}")
async def send_manual_reminder(member_id: str):
    """Send manual reminder to a specific member"""
    try:
        service = get_reminder_service()
        if not service:
            raise HTTPException(status_code=500, detail="Reminder service not initialized")
        
        result = await service.send_manual_reminder(member_id)
        if result["success"]:
            return {"message": result["message"]}
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending manual reminder: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders/history")
async def get_reminder_history(member_id: str = None):
    """Get reminder history"""
    try:
        service = get_reminder_service()
        if not service:
            raise HTTPException(status_code=500, detail="Reminder service not initialized")
        
        history = await service.get_reminder_history(member_id)
        return {"reminders": history}
        
    except Exception as e:
        logger.error(f"Error getting reminder history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/reminders/test")
async def test_reminder_service():
    """Test the reminder service manually"""
    try:
        service = get_reminder_service()
        if not service:
            raise HTTPException(status_code=500, detail="Reminder service not initialized")
        
        await service.check_and_send_reminders()
        return {"message": "Reminder check completed successfully"}
        
    except Exception as e:
        logger.error(f"Error testing reminder service: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    global reminder_service_instance
    try:
        # Initialize reminder service
        reminder_service_instance = init_reminder_service(client, os.environ['DB_NAME'])
        reminder_service_instance.start()
        logger.info("Reminder service started successfully")
    except Exception as e:
        logger.error(f"Failed to start reminder service: {e}")

@app.on_event("shutdown")
async def shutdown_db_client():
    """Cleanup on shutdown"""
    global reminder_service_instance
    try:
        if reminder_service_instance:
            reminder_service_instance.stop()
            logger.info("Reminder service stopped")
    except Exception as e:
        logger.error(f"Error stopping reminder service: {e}")
    
    client.close()
