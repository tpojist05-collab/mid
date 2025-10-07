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
import hashlib
import secrets
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi import Depends, status

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

# Authentication setup
SECRET_KEY = os.environ['JWT_SECRET_KEY']
ALGORITHM = os.environ['JWT_ALGORITHM']
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'])

# Using SHA256 with salt for password hashing (simpler approach)
def create_salt():
    return secrets.token_hex(32)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

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
    UPI = "upi"
    CARD = "card"
    NET_BANKING = "net_banking"
    RAZORPAY = "razorpay"
    PAYU = "payu"
    GOOGLE_PAY = "google_pay"
    PAYTM = "paytm"
    PHONEPE = "phonepe"

class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    TRAINER = "trainer"
    RECEPTIONIST = "receptionist"

class MemberStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    FROZEN = "frozen"

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
    member_status: MemberStatus = MemberStatus.ACTIVE
    total_amount_due: float
    admission_fee_amount: float = 0.0  # Will be set from gym settings
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

# Authentication Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.RECEPTIONIST
    custom_role_id: Optional[str] = None  # For custom roles
    permissions: List[str] = Field(default_factory=list)  # Cached permissions
    is_active: bool = True
    created_by: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    password: str
    role: UserRole = UserRole.RECEPTIONIST
    custom_role_id: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

class TokenData(BaseModel):
    username: Optional[str] = None

# Settings Models
class GymSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    gym_name: str = "Iron Paradise Gym"
    gym_address: str = ""
    gym_phone: str = ""
    gym_email: str = ""
    gym_logo_url: str = ""
    membership_plans: dict = Field(default_factory=dict)
    terms_conditions: str = ""
    updated_by: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SettingsUpdate(BaseModel):
    gym_name: Optional[str] = None
    gym_address: Optional[str] = None
    gym_phone: Optional[str] = None
    gym_email: Optional[str] = None
    gym_logo_url: Optional[str] = None
    membership_plans: Optional[dict] = None
    admission_fee: Optional[float] = None
    terms_conditions: Optional[str] = None

# Advanced Role & Permission Models
class Permission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    module: str  # members, payments, reminders, settings, etc.
    actions: List[str]  # read, write, delete, etc.

class CustomRole(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    permissions: List[str]  # List of permission IDs
    created_by: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoleCreate(BaseModel):
    name: str
    description: str
    permissions: List[str]

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[str]] = None

# Payment Gateway Models
class PaymentGateway(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    provider: str  # razorpay, payu, ccavenue, instamojo
    is_active: bool = True
    config: dict = Field(default_factory=dict)
    supported_methods: List[str] = Field(default_factory=list)

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    member_id: str
    amount: float
    method: PaymentMethod = PaymentMethod.CASH
    description: str = ""
    payment_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: PaymentStatus = PaymentStatus.PAID
    transaction_id: Optional[str] = None
    gateway_response: Optional[dict] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MonthlyEarnings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    year: int
    month: int
    month_name: str
    total_earnings: float = 0.0
    cash_earnings: float = 0.0
    upi_earnings: float = 0.0
    card_earnings: float = 0.0
    online_earnings: float = 0.0  # Razorpay, PayU, etc.
    total_payments: int = 0
    cash_payments: int = 0
    upi_payments: int = 0
    card_payments: int = 0
    online_payments: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PaymentSummary(BaseModel):
    date: str
    total_amount: float
    cash_amount: float
    upi_amount: float
    card_amount: float
    online_amount: float
    payment_count: int
    cash_count: int
    upi_count: int
    card_count: int
    online_count: int

class SystemNotification(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    message: str
    type: str  # info, warning, error, success
    user_id: Optional[str] = None  # If None, broadcast to all
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Authentication Helper Functions
def verify_password(plain_password, stored_hash):
    try:
        # stored_hash format: "salt:hash"
        salt, hash_value = stored_hash.split(':')
        return hash_value == hashlib.sha256((plain_password + salt).encode()).hexdigest()
    except Exception:
        return False

def get_password_hash(password):
    salt = create_salt()
    hash_value = hashlib.sha256((password + salt).encode()).hexdigest()
    return f"{salt}:{hash_value}"

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": token_data.username})
    if user is None:
        raise credentials_exception
    return User(**parse_from_mongo(user))

async def get_current_active_user(current_user: User = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def require_admin_role(current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user

async def check_permission(user: User, module: str, action: str) -> bool:
    """Check if user has specific permission"""
    if user.role == UserRole.ADMIN:
        return True  # Admin has all permissions
    
    # Check user's cached permissions
    permission_key = f"{module}:{action}"
    return permission_key in user.permissions

def require_permission(module: str, action: str):
    """Decorator factory for permission checking"""
    async def permission_checker(current_user: User = Depends(get_current_active_user)):
        if not await check_permission(current_user, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: {module}:{action}"
            )
        return current_user
    return permission_checker

async def initialize_default_permissions():
    """Initialize default permissions in database"""
    try:
        # Check if permissions already exist
        existing_perms = await db.permissions.count_documents({})
        if existing_perms > 0:
            return
        
        # Define default permissions
        default_permissions = [
            Permission(name="View Members", description="View member list and details", module="members", actions=["read"]),
            Permission(name="Add Members", description="Add new members", module="members", actions=["write"]),
            Permission(name="Edit Members", description="Edit member information", module="members", actions=["write"]),
            Permission(name="Delete Members", description="Delete members", module="members", actions=["delete"]),
            Permission(name="View Payments", description="View payment records", module="payments", actions=["read"]),
            Permission(name="Process Payments", description="Process and record payments", module="payments", actions=["write"]),
            Permission(name="View Reports", description="View financial and member reports", module="reports", actions=["read"]),
            Permission(name="Send Reminders", description="Send SMS/WhatsApp reminders", module="reminders", actions=["write"]),
            Permission(name="System Settings", description="Access system settings", module="settings", actions=["read", "write"]),
            Permission(name="User Management", description="Manage users and roles", module="users", actions=["read", "write", "delete"]),
            Permission(name="Role Management", description="Create and manage custom roles", module="roles", actions=["read", "write", "delete"])
        ]
        
        for perm in default_permissions:
            perm_dict = prepare_for_mongo(perm.dict())
            await db.permissions.insert_one(perm_dict)
        
        logger.info("Default permissions initialized")
        
    except Exception as e:
        logger.error(f"Error initializing permissions: {e}")

async def update_user_permissions(user_id: str):
    """Update user's cached permissions based on role"""
    try:
        user = await db.users.find_one({"id": user_id})
        if not user:
            return
        
        permissions = []
        
        if user.get("role") == "admin":
            # Admin gets all permissions
            all_perms = await db.permissions.find().to_list(1000)
            for perm in all_perms:
                for action in perm.get("actions", []):
                    permissions.append(f"{perm['module']}:{action}")
        
        elif user.get("custom_role_id"):
            # Get permissions from custom role
            custom_role = await db.custom_roles.find_one({"id": user["custom_role_id"]})
            if custom_role:
                for perm_id in custom_role.get("permissions", []):
                    perm = await db.permissions.find_one({"id": perm_id})
                    if perm:
                        for action in perm.get("actions", []):
                            permissions.append(f"{perm['module']}:{action}")
        
        else:
            # Default role permissions
            role_permissions = {
                "manager": ["members:read", "members:write", "payments:read", "payments:write", "reports:read", "reminders:write"],
                "trainer": ["members:read", "reminders:write"],
                "receptionist": ["members:read", "members:write", "payments:read", "payments:write"]
            }
            permissions = role_permissions.get(user.get("role"), [])
        
        # Update user's cached permissions
        await db.users.update_one(
            {"id": user_id},
            {"$set": {"permissions": permissions}}
        )
        
    except Exception as e:
        logger.error(f"Error updating user permissions: {e}")

# Helper functions
async def calculate_membership_fee(membership_type: MembershipType) -> float:
    """Calculate membership fee based on type"""
    # Get current settings from database
    settings = await db.gym_settings.find_one({"setting_name": "membership_rates"})
    if settings and "rates" in settings:
        rates = settings["rates"]
    else:
        # Default rates
        rates = {
            "monthly": 2000.0,
            "quarterly": 5500.0,  # 3 months with discount
            "six_monthly": 10500.0  # 6 months with discount
        }
    
    membership_key = membership_type.value if hasattr(membership_type, 'value') else str(membership_type)
    return rates.get(membership_key, 2000.0)

async def get_admission_fee() -> float:
    """Get current admission fee for monthly membership"""
    settings = await db.gym_settings.find_one({"setting_name": "admission_fee"})
    if settings and "amount" in settings:
        return settings["amount"]
    return 1500.0  # Default admission fee

async def calculate_membership_extension(payment_amount: float) -> int:
    """Calculate membership extension days based on payment amount"""
    try:
        # Get current membership rates
        settings = await db.gym_settings.find_one({"setting_name": "membership_rates"})
        if settings and "rates" in settings:
            rates = settings["rates"]
        else:
            # Default rates
            rates = {
                "MONTHLY": 2000.0,
                "QUARTERLY": 5500.0,
                "SIX_MONTHLY": 10500.0
            }
        
        monthly_rate = rates.get("MONTHLY", 2000.0)
        
        # Calculate days based on monthly rate (30 days per month)
        if monthly_rate > 0:
            months = payment_amount / monthly_rate
            return int(months * 30)  # 30 days per month
        
        return 30  # Default to 30 days if rate is invalid
    except Exception as e:
        logger.error(f"Error calculating membership extension: {e}")
        return 30

async def update_monthly_earnings(payment: dict):
    """Update monthly earnings when a payment is recorded"""
    try:
        payment_date = payment['payment_date']
        if isinstance(payment_date, str):
            payment_date = datetime.fromisoformat(payment_date)
        
        year = payment_date.year
        month = payment_date.month
        month_name = payment_date.strftime('%B')
        amount = payment['amount']
        method = payment['payment_method']
        
        # Find or create monthly earnings record
        earnings_query = {"year": year, "month": month}
        existing_earnings = await db.monthly_earnings.find_one(earnings_query)
        
        if existing_earnings:
            # Update existing record
            update_data = {
                "total_earnings": existing_earnings["total_earnings"] + amount,
                "total_payments": existing_earnings["total_payments"] + 1,
                "updated_at": datetime.now(timezone.utc)
            }
            
            # Update specific payment method earnings
            if method == "cash":
                update_data["cash_earnings"] = existing_earnings["cash_earnings"] + amount
                update_data["cash_payments"] = existing_earnings["cash_payments"] + 1
            elif method == "upi":
                update_data["upi_earnings"] = existing_earnings["upi_earnings"] + amount
                update_data["upi_payments"] = existing_earnings["upi_payments"] + 1
            elif method == "card":
                update_data["card_earnings"] = existing_earnings["card_earnings"] + amount
                update_data["card_payments"] = existing_earnings["card_payments"] + 1
            else:
                # Online payment gateways
                update_data["online_earnings"] = existing_earnings["online_earnings"] + amount
                update_data["online_payments"] = existing_earnings["online_payments"] + 1
            
            await db.monthly_earnings.update_one(earnings_query, {"$set": update_data})
        else:
            # Create new record
            earnings_data = {
                "year": year,
                "month": month,
                "month_name": month_name,
                "total_earnings": amount,
                "cash_earnings": amount if method == "cash" else 0.0,
                "upi_earnings": amount if method == "upi" else 0.0,
                "card_earnings": amount if method == "card" else 0.0,
                "online_earnings": amount if method not in ["cash", "upi", "card"] else 0.0,
                "total_payments": 1,
                "cash_payments": 1 if method == "cash" else 0,
                "upi_payments": 1 if method == "upi" else 0,
                "card_payments": 1 if method == "card" else 0,
                "online_payments": 1 if method not in ["cash", "upi", "card"] else 0,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            
            await db.monthly_earnings.insert_one(earnings_data)
        
        logger.info(f"Monthly earnings updated for {month_name} {year}: +₹{amount} ({method})")
        
    except Exception as e:
        logger.error(f"Error updating monthly earnings: {e}")

async def get_payment_method_category(method: str) -> str:
    """Categorize payment method for earnings tracking"""
    if method in ["cash"]:
        return "cash"
    elif method in ["upi", "google_pay", "phonepe", "paytm"]:
        return "upi"
    elif method in ["card"]:
        return "card"
    else:
        return "online"

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
    if item is None:
        return item
        
    # Remove MongoDB ObjectId if present
    if '_id' in item:
        del item['_id']
    
    # Convert ObjectId to string if found in any field
    for key, value in item.items():
        if hasattr(value, '__class__') and value.__class__.__name__ == 'ObjectId':
            item[key] = str(value)
    
    # Parse dates
    datetime_fields = ['join_date', 'membership_start', 'membership_end', 'created_at', 'updated_at', 'payment_date']
    for field in datetime_fields:
        if field in item and isinstance(item[field], str):
            try:
                item[field] = datetime.fromisoformat(item[field])
            except ValueError:
                pass
        elif field in item and item[field] is None:
            # Handle None values by setting a default datetime for required fields
            if field in ['join_date', 'membership_start', 'membership_end', 'created_at', 'updated_at']:
                item[field] = datetime.now(timezone.utc)
    
    return item

# API Routes
@api_router.get("/")
async def root():
    return {"message": "Iron Paradise Gym Management API"}

# Authentication Routes
@api_router.post("/auth/register", response_model=User)
async def register_user(user_data: UserCreate, current_admin: User = Depends(require_admin_role)):
    try:
        # Check if username already exists
        existing_user = await db.users.find_one({"username": user_data.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already registered")
        
        # Check if email already exists
        existing_email = await db.users.find_one({"email": user_data.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Hash password and create user
        hashed_password = get_password_hash(user_data.password)
        user = User(
            **user_data.dict(exclude={'password'}),
            created_by=current_admin.username
        )
        
        user_dict = prepare_for_mongo(user.dict())
        user_dict['hashed_password'] = hashed_password
        
        await db.users.insert_one(user_dict)
        
        # Update user permissions
        await update_user_permissions(user.id)
        
        # Send notification
        await send_system_notification(
            f"New user '{user.full_name}' added",
            f"User created with role: {user.role} by {current_admin.full_name}",
            "info"
        )
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/users/{user_id}", response_model=User)
async def update_user(
    user_id: str, 
    user_update: UserCreate,
    current_admin: User = Depends(require_admin_role)
):
    try:
        # Prevent admin from changing their own role
        if current_admin.id == user_id and user_update.role != UserRole.ADMIN:
            raise HTTPException(status_code=400, detail="Cannot change your own admin role")
        
        existing_user = await db.users.find_one({"id": user_id})
        if not existing_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if username/email conflicts exist (excluding current user)
        if user_update.username != existing_user["username"]:
            existing_username = await db.users.find_one({
                "username": user_update.username,
                "id": {"$ne": user_id}
            })
            if existing_username:
                raise HTTPException(status_code=400, detail="Username already exists")
        
        if user_update.email != existing_user["email"]:
            existing_email = await db.users.find_one({
                "email": user_update.email,
                "id": {"$ne": user_id}
            })
            if existing_email:
                raise HTTPException(status_code=400, detail="Email already exists")
        
        # Update user data
        update_data = user_update.dict(exclude={'password'})
        update_data['updated_at'] = datetime.now(timezone.utc)
        
        # Update password if provided
        if user_update.password:
            update_data['hashed_password'] = get_password_hash(user_update.password)
        
        update_data = prepare_for_mongo(update_data)
        
        await db.users.update_one(
            {"id": user_id},
            {"$set": update_data}
        )
        
        # Update user permissions
        await update_user_permissions(user_id)
        
        # Send notification
        await send_system_notification(
            f"User '{user_update.full_name}' updated",
            f"User details updated by {current_admin.full_name}",
            "info"
        )
        
        # Get updated user
        updated_user = await db.users.find_one({"id": user_id})
        return User(**parse_from_mongo(updated_user))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_admin: User = Depends(require_admin_role)):
    try:
        # Prevent admin from deleting themselves
        if current_admin.id == user_id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if it's the last admin
        if user.get("role") == "admin":
            admin_count = await db.users.count_documents({"role": "admin"})
            if admin_count <= 1:
                raise HTTPException(status_code=400, detail="Cannot delete the last admin user")
        
        await db.users.delete_one({"id": user_id})
        
        # Send notification
        await send_system_notification(
            f"User '{user['full_name']}' deleted",
            f"User account deleted by {current_admin.full_name}",
            "warning"
        )
        
        return {"message": f"User {user['full_name']} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/auth/login", response_model=Token)
async def login_user(form_data: OAuth2PasswordRequestForm = Depends()):
    try:
        user = await db.users.find_one({"username": form_data.username})
        if not user or not verify_password(form_data.password, user.get('hashed_password')):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        if not user.get('is_active', True):
            raise HTTPException(status_code=400, detail="Inactive user")
        
        # Update last login time and refresh permissions
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"last_login": datetime.now(timezone.utc)}}
        )
        
        # Refresh user permissions
        await update_user_permissions(user["id"])
        
        # Get updated user data
        updated_user = await db.users.find_one({"id": user["id"]})
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user["username"]}, expires_delta=access_token_expires
        )
        
        user_data = User(**parse_from_mongo(updated_user))
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user_data.dict(exclude={'hashed_password'})
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    return current_user

@api_router.get("/users", response_model=List[User])
async def get_all_users(current_user: User = Depends(require_permission("users", "read"))):
    try:
        users = await db.users.find().to_list(None)  # No limit on users
        return [User(**parse_from_mongo(user)) for user in users]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Role Management Routes
@api_router.get("/roles", response_model=List[CustomRole])
async def get_roles(current_user: User = Depends(require_permission("roles", "read"))):
    try:
        roles = await db.custom_roles.find().to_list(1000)
        return [CustomRole(**parse_from_mongo(role)) for role in roles]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/roles", response_model=CustomRole)
async def create_role(
    role_data: RoleCreate, 
    current_user: User = Depends(require_permission("roles", "write"))
):
    try:
        # Check if role name already exists
        existing_role = await db.custom_roles.find_one({"name": role_data.name})
        if existing_role:
            raise HTTPException(status_code=400, detail="Role name already exists")
        
        role = CustomRole(
            **role_data.dict(),
            created_by=current_user.username
        )
        
        role_dict = prepare_for_mongo(role.dict())
        await db.custom_roles.insert_one(role_dict)
        
        # Send notification
        await send_system_notification(
            f"New role '{role.name}' created",
            f"Role created by {current_user.full_name}",
            "info"
        )
        
        return role
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/roles/{role_id}", response_model=CustomRole)
async def update_role(
    role_id: str,
    role_update: RoleUpdate,
    current_user: User = Depends(require_permission("roles", "write"))
):
    try:
        existing_role = await db.custom_roles.find_one({"id": role_id})
        if not existing_role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        update_data = {k: v for k, v in role_update.dict().items() if v is not None}
        update_data['updated_at'] = datetime.now(timezone.utc)
        
        update_data = prepare_for_mongo(update_data)
        
        await db.custom_roles.update_one(
            {"id": role_id},
            {"$set": update_data}
        )
        
        # Update permissions for all users with this role
        users_with_role = await db.users.find({"custom_role_id": role_id}).to_list(1000)
        for user in users_with_role:
            await update_user_permissions(user["id"])
        
        updated_role = await db.custom_roles.find_one({"id": role_id})
        return CustomRole(**parse_from_mongo(updated_role))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    current_user: User = Depends(require_permission("roles", "delete"))
):
    try:
        # Check if any users have this role
        users_with_role = await db.users.count_documents({"custom_role_id": role_id})
        if users_with_role > 0:
            raise HTTPException(
                status_code=400, 
                detail=f"Cannot delete role. {users_with_role} users currently have this role."
            )
        
        result = await db.custom_roles.delete_one({"id": role_id})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Role not found")
        
        return {"message": "Role deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/permissions", response_model=List[Permission])
async def get_permissions(current_user: User = Depends(require_permission("roles", "read"))):
    try:
        permissions = await db.permissions.find().to_list(1000)
        return [Permission(**parse_from_mongo(perm)) for perm in permissions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Member Management Routes
@api_router.post("/members", response_model=Member)
async def create_member(member_data: MemberCreate, current_user: User = Depends(get_current_active_user)):
    try:
        # Set join date if not provided (can be backdate)
        join_date = member_data.join_date or datetime.now(timezone.utc)
        
        # Calculate membership fee
        membership_fee = await calculate_membership_fee(member_data.membership_type)
        membership_end = calculate_membership_end_date(join_date, member_data.membership_type)
        
        # Apply admission fee ONLY for monthly memberships
        admission_fee = 0.0
        if member_data.membership_type == MembershipType.MONTHLY:
            admission_fee = await get_admission_fee()
        
        # Calculate total amount due
        total_due = admission_fee + membership_fee
        
        member = Member(
            **member_data.dict(exclude={'join_date'}),
            join_date=join_date,
            membership_start=join_date,
            membership_end=membership_end,
            monthly_fee_amount=membership_fee,
            admission_fee_amount=admission_fee,
            total_amount_due=total_due
        )
        
        # Prepare for MongoDB storage
        member_dict = prepare_for_mongo(member.dict())
        await db.members.insert_one(member_dict)
        
        # Send notification
        await send_system_notification(
            f"New member '{member.name}' added",
            f"Membership: {member_data.membership_type.value} | Start: {join_date.strftime('%Y-%m-%d')} | Total: ₹{total_due}" + 
            (f" (includes ₹{admission_fee} admission fee)" if admission_fee > 0 else ""),
            "info"
        )
        
        return member
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/members", response_model=List[Member])
async def get_members(
    status: Optional[str] = None, 
    current_user: User = Depends(get_current_active_user)
):
    try:
        query = {}
        current_time = datetime.now(timezone.utc)
        
        # Filter by status if provided
        if status:
            if status == "active":
                # Active members: paid and membership not expired
                query["$and"] = [
                    {"current_payment_status": {"$in": ["paid", "active"]}},
                    {"membership_end": {"$gt": current_time.isoformat()}}
                ]
            elif status == "expired":
                # Expired members: membership end date has passed
                query["membership_end"] = {"$lt": current_time.isoformat()}
            elif status == "expiring_7days":
                # Members expiring within 7 days
                seven_days_from_now = current_time + timedelta(days=7)
                query["$and"] = [
                    {"membership_end": {"$gt": current_time.isoformat()}},
                    {"membership_end": {"$lte": seven_days_from_now.isoformat()}}
                ]
            elif status == "expiring_30days":
                # Members expiring within 30 days
                thirty_days_from_now = current_time + timedelta(days=30)
                query["$and"] = [
                    {"membership_end": {"$gt": current_time.isoformat()}},
                    {"membership_end": {"$lte": thirty_days_from_now.isoformat()}}
                ]
            elif status == "inactive":
                query["current_payment_status"] = {"$in": ["unpaid", "inactive", "suspended"]}
            elif status == "pending":
                query["current_payment_status"] = "pending"
        
        members = await db.members.find(query).to_list(1000)
        
        # Update member status based on expiry for all members
        updated_members = []
        for member in members:
            # Clean MongoDB document
            member_obj = parse_from_mongo(member.copy())
            
            # Check if member is expired
            if member_obj.get('membership_end'):
                try:
                    if isinstance(member_obj['membership_end'], str):
                        membership_end = datetime.fromisoformat(member_obj['membership_end'])
                    else:
                        membership_end = member_obj['membership_end']
                        
                    if membership_end < current_time:
                        # Member is expired - update status
                        await db.members.update_one(
                            {"id": member_obj['id']},
                            {"$set": {"current_payment_status": "expired"}}
                        )
                        member_obj['current_payment_status'] = "expired"
                except (ValueError, TypeError):
                    # Handle invalid date format
                    pass
            
            # Ensure all required fields exist with defaults
            member_obj.setdefault('id', str(uuid.uuid4()))
            member_obj.setdefault('name', 'Unknown')
            member_obj.setdefault('email', '')
            member_obj.setdefault('phone', '')
            member_obj.setdefault('membership_type', MembershipType.MONTHLY)
            member_obj.setdefault('current_payment_status', PaymentStatus.PENDING)
            member_obj.setdefault('member_status', MemberStatus.ACTIVE)
            
            try:
                updated_members.append(Member(**member_obj))
            except Exception as e:
                logger.error(f"Error creating member object: {e}, data: {member_obj}")
                # Skip invalid members
                continue
        
        return updated_members
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
async def update_member(
    member_id: str, 
    member_update: MemberCreate,
    current_user: User = Depends(get_current_active_user)
):
    try:
        existing_member = await db.members.find_one({"id": member_id})
        if not existing_member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Update member data
        update_data = member_update.dict()
        update_data['updated_at'] = datetime.now(timezone.utc)
        
        # Handle join_date changes (including backdating)
        new_join_date = member_update.join_date or existing_member.get('join_date')
        if isinstance(new_join_date, str):
            new_join_date = datetime.fromisoformat(new_join_date)
        
        update_data['join_date'] = new_join_date
        update_data['membership_start'] = new_join_date
        
        # Recalculate membership end date if join date or membership type changed
        new_membership_end = calculate_membership_end_date(new_join_date, member_update.membership_type)
        update_data['membership_end'] = new_membership_end
        
        # Recalculate fees if membership type changed
        membership_fee = await calculate_membership_fee(member_update.membership_type)
        update_data['monthly_fee_amount'] = membership_fee
        
        # Apply admission fee ONLY for monthly memberships (and only if type changed to monthly)
        admission_fee = 0.0
        existing_type = existing_member.get('membership_type', '')
        if member_update.membership_type == MembershipType.MONTHLY:
            if existing_type != 'monthly':
                # Only charge admission fee when switching TO monthly from another type
                admission_fee = await get_admission_fee()
            else:
                # Keep existing admission fee for monthly members
                admission_fee = existing_member.get('admission_fee_amount', 0.0)
        
        # If switching FROM monthly to another type, remove admission fee
        elif existing_type == 'monthly' and member_update.membership_type != MembershipType.MONTHLY:
            admission_fee = 0.0
        else:
            # Keep existing admission fee for other cases
            admission_fee = existing_member.get('admission_fee_amount', 0.0)
        
        update_data['admission_fee_amount'] = admission_fee
        update_data['total_amount_due'] = admission_fee + membership_fee
        
        # Prepare for MongoDB
        update_data = prepare_for_mongo(update_data)
        
        await db.members.update_one(
            {"id": member_id},
            {"$set": update_data}
        )
        
        # Send notification about member update
        await send_system_notification(
            f"Member '{existing_member.get('name')}' updated",
            f"Updated by {current_user.full_name} | Type: {member_update.membership_type.value} | Start: {new_join_date.strftime('%Y-%m-%d')}",
            "info"
        )
        
        # Get updated member
        updated_member = await db.members.find_one({"id": member_id})
        return Member(**parse_from_mongo(updated_member))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/members/{member_id}/start-date")
async def update_member_start_date(
    member_id: str,
    date_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Update member's gym start date (supports backdating)"""
    try:
        existing_member = await db.members.find_one({"id": member_id})
        if not existing_member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        new_start_date = date_data.get("start_date")
        if not new_start_date:
            raise HTTPException(status_code=400, detail="Start date is required")
        
        # Parse the new start date
        if isinstance(new_start_date, str):
            try:
                new_start_date = datetime.fromisoformat(new_start_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format")
        
        # Get membership type
        membership_type = MembershipType(existing_member.get('membership_type', 'MONTHLY'))
        
        # Calculate new membership end date
        new_end_date = calculate_membership_end_date(new_start_date, membership_type)
        
        # Update member record
        update_data = {
            'join_date': new_start_date.isoformat(),
            'membership_start': new_start_date.isoformat(),
            'membership_end': new_end_date.isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.members.update_one(
            {"id": member_id},
            {"$set": update_data}
        )
        
        # Send notification
        await send_system_notification(
            "Member start date updated",
            f"'{existing_member.get('name')}' start date changed to {new_start_date.strftime('%Y-%m-%d')} by {current_user.full_name}",
            "info"
        )
        
        return {
            "message": "Member start date updated successfully",
            "member_id": member_id,
            "old_start_date": existing_member.get('join_date'),
            "new_start_date": new_start_date.isoformat(),
            "new_end_date": new_end_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/members/{member_id}/end-date")
async def update_member_end_date(
    member_id: str,
    date_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Update member's membership end date directly"""
    try:
        existing_member = await db.members.find_one({"id": member_id})
        if not existing_member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        new_end_date = date_data.get("end_date")
        if not new_end_date:
            raise HTTPException(status_code=400, detail="End date is required")
        
        # Parse the new end date
        if isinstance(new_end_date, str):
            try:
                new_end_date = datetime.fromisoformat(new_end_date.replace('Z', '+00:00'))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format")
        
        # Update member record
        update_data = {
            'membership_end': new_end_date.isoformat(),
            'updated_at': datetime.now(timezone.utc).isoformat()
        }
        
        await db.members.update_one(
            {"id": member_id},
            {"$set": update_data}
        )
        
        # Send notification
        await send_system_notification(
            "Member end date updated",
            f"'{existing_member.get('name')}' membership end date changed to {new_end_date.strftime('%Y-%m-%d')} by {current_user.full_name}",
            "info"
        )
        
        return {
            "message": "Member end date updated successfully",
            "member_id": member_id,
            "old_end_date": existing_member.get('membership_end'),
            "new_end_date": new_end_date.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/members/{member_id}")
async def delete_member(member_id: str, current_user: User = Depends(get_current_active_user)):
    try:
        # Check if member exists
        member = await db.members.find_one({"id": member_id})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Only admin can delete members, staff can only suspend
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=403, 
                detail="Only administrators can delete members. Use suspend instead."
            )
        
        # Delete the member
        await db.members.delete_one({"id": member_id})
        
        # Send notification
        await send_system_notification(
            f"Member '{member['name']}' deleted",
            f"Member deleted by {current_user.full_name}",
            "warning"
        )
        
        return {"message": f"Member '{member['name']}' deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/members/bulk-delete")
async def bulk_delete_members(
    delete_data: dict,
    current_admin: User = Depends(require_admin_role)
):
    """Bulk delete multiple members (admin only)"""
    try:
        member_ids = delete_data.get("member_ids", [])
        if not member_ids:
            raise HTTPException(status_code=400, detail="No member IDs provided")
        
        if len(member_ids) > 100:
            raise HTTPException(status_code=400, detail="Cannot delete more than 100 members at once")
        
        # Get member names for notification
        members = await db.members.find({"id": {"$in": member_ids}}).to_list(1000)
        member_names = [member.get("name", "Unknown") for member in members]
        
        # Delete members
        result = await db.members.delete_many({"id": {"$in": member_ids}})
        
        # Send notification
        await send_system_notification(
            f"Bulk delete: {result.deleted_count} members",
            f"Members deleted: {', '.join(member_names[:5])}{'...' if len(member_names) > 5 else ''} by {current_admin.full_name}",
            "warning"
        )
        
        return {
            "message": f"Successfully deleted {result.deleted_count} members",
            "deleted_count": result.deleted_count,
            "member_names": member_names
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/members/{member_id}/status")
async def update_member_status(
    member_id: str, 
    status: MemberStatus,
    current_user: User = Depends(get_current_active_user)
):
    try:
        member = await db.members.find_one({"id": member_id})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        await db.members.update_one(
            {"id": member_id},
            {"$set": {
                "member_status": status.value,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {"message": f"Member status updated to {status.value}"}
        
    except HTTPException:
        raise
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
        
        # Update monthly earnings
        await update_monthly_earnings(payment_dict)
        
        # Calculate membership extension based on payment amount
        membership_extension = await calculate_membership_extension(payment.amount)
        
        # Get current member data
        current_member = await db.members.find_one({"id": payment_data.member_id})
        current_end_date = datetime.now(timezone.utc)
        
        # Use existing end date if membership is still active, otherwise start from today
        if current_member and current_member.get('membership_end'):
            try:
                existing_end_date = datetime.fromisoformat(current_member['membership_end'])
                if existing_end_date > datetime.now(timezone.utc):
                    current_end_date = existing_end_date
            except (ValueError, TypeError):
                pass
        
        # Calculate new expiry date
        new_expiry_date = current_end_date + timedelta(days=membership_extension)
        
        # Update member status and expiry
        await db.members.update_one(
            {"id": payment_data.member_id},
            {"$set": {
                "current_payment_status": "paid",
                "member_status": "active",
                "membership_end": new_expiry_date.isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Send notification
        await send_system_notification(
            f"Payment recorded: ₹{payment.amount}",
            f"Payment of ₹{payment.amount} recorded for {member['name']} via {payment.payment_method.upper()}",
            "info"
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

@api_router.get("/payments")
async def get_all_payments():
    try:
        payments = await db.payments.find().sort("payment_date", -1).to_list(1000)
        
        # Clean payments data for serialization
        cleaned_payments = []
        for payment in payments:
            cleaned_payment = parse_from_mongo(payment.copy())
            # Ensure required fields exist
            cleaned_payment.setdefault('id', str(uuid.uuid4()))
            cleaned_payment.setdefault('member_id', '')
            cleaned_payment.setdefault('amount', 0)
            cleaned_payment.setdefault('method', 'cash')
            cleaned_payment.setdefault('payment_date', datetime.now(timezone.utc))
            
            cleaned_payments.append(cleaned_payment)
        
        return cleaned_payments
    except Exception as e:
        logger.error(f"Error fetching payments: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Monthly Earnings Routes
@api_router.get("/earnings/monthly", response_model=List[MonthlyEarnings])
async def get_monthly_earnings(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_active_user)
):
    """Get monthly earnings data, optionally filtered by year"""
    try:
        query = {}
        if year:
            query["year"] = year
        
        earnings = await db.monthly_earnings.find(query).sort([("year", -1), ("month", -1)]).to_list(1000)
        return [MonthlyEarnings(**parse_from_mongo(earning)) for earning in earnings]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/earnings/monthly/{year}/{month}", response_model=MonthlyEarnings)
async def get_monthly_earning_detail(
    year: int,
    month: int,
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed monthly earnings for a specific month"""
    try:
        earning = await db.monthly_earnings.find_one({"year": year, "month": month})
        if not earning:
            # Return empty earnings record if no data found
            month_names = ["", "January", "February", "March", "April", "May", "June",
                          "July", "August", "September", "October", "November", "December"]
            return MonthlyEarnings(
                year=year,
                month=month,
                month_name=month_names[month] if 1 <= month <= 12 else "Unknown"
            )
        return MonthlyEarnings(**parse_from_mongo(earning))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/earnings/summary")
async def get_earnings_summary(current_user: User = Depends(get_current_active_user)):
    """Get earnings summary with totals and trends"""
    try:
        # Get current year earnings
        current_year = datetime.now(timezone.utc).year
        yearly_earnings = await db.monthly_earnings.find({"year": current_year}).to_list(1000)
        
        # Calculate totals
        total_yearly = sum(earning.get("total_earnings", 0) for earning in yearly_earnings)
        total_cash = sum(earning.get("cash_earnings", 0) for earning in yearly_earnings)
        total_upi = sum(earning.get("upi_earnings", 0) for earning in yearly_earnings)
        total_card = sum(earning.get("card_earnings", 0) for earning in yearly_earnings)
        total_online = sum(earning.get("online_earnings", 0) for earning in yearly_earnings)
        
        # Get current month earnings
        current_month = datetime.now(timezone.utc).month
        current_month_earning = await db.monthly_earnings.find_one({
            "year": current_year,
            "month": current_month
        })
        
        current_month_total = current_month_earning.get("total_earnings", 0) if current_month_earning else 0
        
        # Get previous month for comparison
        prev_month = current_month - 1 if current_month > 1 else 12
        prev_year = current_year if current_month > 1 else current_year - 1
        
        prev_month_earning = await db.monthly_earnings.find_one({
            "year": prev_year,
            "month": prev_month
        })
        
        prev_month_total = prev_month_earning.get("total_earnings", 0) if prev_month_earning else 0
        
        # Calculate growth percentage
        growth_percentage = 0
        if prev_month_total > 0:
            growth_percentage = ((current_month_total - prev_month_total) / prev_month_total) * 100
        
        return {
            "current_year": current_year,
            "yearly_total": total_yearly,
            "current_month_total": current_month_total,
            "previous_month_total": prev_month_total,
            "growth_percentage": round(growth_percentage, 2),
            "payment_method_breakdown": {
                "cash": total_cash,
                "upi": total_upi,
                "card": total_card,
                "online": total_online
            },
            "monthly_data": [MonthlyEarnings(**parse_from_mongo(earning)) for earning in yearly_earnings]
        }
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
        
        # Calculate membership extension based on payment amount
        membership_extension = await calculate_membership_extension(payment_record.amount)
        
        # Get current member data
        current_member = await db.members.find_one({"id": payment_data.member_id})
        current_end_date = datetime.now(timezone.utc)
        
        # Use existing end date if membership is still active, otherwise start from today
        if current_member and current_member.get('membership_end'):
            try:
                existing_end_date = datetime.fromisoformat(current_member['membership_end'])
                if existing_end_date > datetime.now(timezone.utc):
                    current_end_date = existing_end_date
            except (ValueError, TypeError):
                pass
        
        # Calculate new expiry date
        new_expiry_date = current_end_date + timedelta(days=membership_extension)
        
        # Update member status and expiry
        await db.members.update_one(
            {"id": payment_data.member_id},
            {"$set": {
                "current_payment_status": PaymentStatus.PAID.value,
                "member_status": "active",
                "membership_end": new_expiry_date.isoformat(),
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

# Enhanced Reminder Management
@api_router.post("/reminders/send/{member_id}")
async def send_reminder_to_member(
    member_id: str,
    current_user: User = Depends(get_current_active_user)
):
    try:
        if not reminder_service_instance:
            raise HTTPException(status_code=503, detail="Reminder service not available")
        
        result = await reminder_service_instance.send_manual_reminder(member_id)
        
        if result["success"]:
            # Get member details
            member = await db.members.find_one({"id": member_id})
            
            # Store reminder record
            reminder_record = {
                "id": str(uuid.uuid4()),
                "member_id": member_id,
                "member_name": member['name'] if member else 'Unknown',
                "member_phone": member.get('phone', '') if member else '',
                "message_sent": result.get("message_content", ""),
                "sent_by": current_user.id,
                "sent_by_name": current_user.full_name,
                "sent_at": datetime.now(timezone.utc),
                "method": "whatsapp",
                "status": "sent"
            }
            
            await db.reminder_logs.insert_one(reminder_record)
            
            # Send notification about manual reminder
            await send_system_notification(
                "Manual reminder sent",
                f"WhatsApp reminder sent to {member['name'] if member else 'member'} by {current_user.full_name}",
                "info"
            )
            return {"message": result["message"]}
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/reminders/send-bulk")
async def send_bulk_reminders(
    days_before_expiry: int,
    current_user: User = Depends(require_admin_role)
):
    """Send WhatsApp reminders to all members expiring in X days (admin only)"""
    try:
        if not reminder_service_instance:
            raise HTTPException(status_code=503, detail="Reminder service not available")
        
        # Get members expiring in specified days
        target_date = datetime.now(timezone.utc) + timedelta(days=days_before_expiry)
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        members = await db.members.find({
            "membership_end": {
                "$gte": start_of_day.isoformat(),
                "$lte": end_of_day.isoformat()
            },
            "current_payment_status": {"$in": ["paid", "pending"]}
        }).to_list(100)
        
        sent_count = 0
        failed_count = 0
        
        for member in members:
            result = await reminder_service_instance.send_manual_reminder(member['id'])
            if result["success"]:
                sent_count += 1
            else:
                failed_count += 1
        
        # Send notification
        await send_system_notification(
            "Bulk reminders sent",
            f"Sent {sent_count} WhatsApp reminders for members expiring in {days_before_expiry} days. {failed_count} failed. Initiated by {current_user.full_name}",
            "info"
        )
        
        return {
            "message": "Bulk reminders completed",
            "sent": sent_count,
            "failed": failed_count,
            "total_members": len(members)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders/history")
async def get_reminder_history(current_user: User = Depends(get_current_active_user)):
    """Get reminder history from stored logs"""
    try:
        # Get reminder logs from database
        logs = await db.reminder_logs.find({}).sort("sent_at", -1).to_list(1000)
        
        # Clean logs data for serialization
        cleaned_logs = []
        for log in logs:
            cleaned_log = parse_from_mongo(log.copy())
            # Convert datetime to string if needed
            if isinstance(cleaned_log.get('sent_at'), datetime):
                cleaned_log['sent_at'] = cleaned_log['sent_at'].isoformat()
            
            cleaned_logs.append(cleaned_log)
        
        return cleaned_logs
        
    except Exception as e:
        logger.error(f"Error fetching reminder history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders/history/{member_id}")
async def get_member_reminder_history(
    member_id: str,
    current_user: User = Depends(get_current_active_user)
):
    try:
        if not reminder_service_instance:
            raise HTTPException(status_code=503, detail="Reminder service not available")
        
        history = await reminder_service_instance.get_reminder_history(member_id)
        return history
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/reminders/expiring-members")
async def get_expiring_members_for_reminders(
    days: int = 7,
    current_user: User = Depends(get_current_active_user)
):
    """Get list of members whose membership expires in X days"""
    try:
        current_time = datetime.now(timezone.utc)
        
        if days == 0:
            # Get already expired members
            members = await db.members.find({
                "membership_end": {"$lt": current_time.isoformat()}
            }).to_list(100)
        elif days < 0:
            # Get all members (for debugging)
            members = await db.members.find({}).to_list(100)
        else:
            # Get members expiring within specified days
            future_date = current_time + timedelta(days=days)
            members = await db.members.find({
                "$and": [
                    {"membership_end": {"$gt": current_time.isoformat()}},
                    {"membership_end": {"$lte": future_date.isoformat()}}
                ]
            }).to_list(100)
        
        # Clean and process members data
        cleaned_members = []
        for member in members:
            cleaned_member = parse_from_mongo(member.copy())
            
            # Calculate days left
            if cleaned_member.get('membership_end'):
                try:
                    if isinstance(cleaned_member['membership_end'], str):
                        end_date = datetime.fromisoformat(cleaned_member['membership_end'])
                    else:
                        end_date = cleaned_member['membership_end']
                    
                    days_left = (end_date - current_time).days
                    cleaned_member['days_until_expiry'] = days_left
                except (ValueError, TypeError, AttributeError):
                    cleaned_member['days_until_expiry'] = 0
            
            # Check if reminder was already sent today
            today = datetime.now(timezone.utc).date()
            reminder_sent = await db.reminder_logs.find_one({
                "member_id": cleaned_member["id"],
                "sent_date": today.isoformat()
            })
            cleaned_member["reminder_sent_today"] = reminder_sent is not None
            
            # Ensure required fields
            cleaned_member.setdefault('name', 'Unknown Member')
            cleaned_member.setdefault('phone', '+91-0000000000')
            cleaned_member.setdefault('membership_type', 'monthly')
            
            cleaned_members.append(cleaned_member)
        
        return {
            "expiring_members": cleaned_members,
            "count": len(cleaned_members),
            "days_until_expiry": days,
            "target_date": (current_time + timedelta(days=days)).strftime("%Y-%m-%d") if days > 0 else "expired"
        }
        
    except Exception as e:
        logger.error(f"Error fetching expiring members: {e}")
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

# Gym Settings Routes
@api_router.get("/settings", response_model=GymSettings)
async def get_gym_settings():
    try:
        settings = await db.gym_settings.find_one()
        if not settings:
            # Create default settings
            default_settings = GymSettings(
                membership_plans={
                    "monthly": {"price": 2000, "duration_days": 30, "name": "Monthly Plan"},
                    "quarterly": {"price": 5500, "duration_days": 90, "name": "Quarterly Plan"},
                    "six_monthly": {"price": 10500, "duration_days": 180, "name": "Six Monthly Plan"}
                },
                gym_name="Iron Paradise Gym",
                gym_address="123 Fitness Street, Gym City",
                gym_phone="+917099197780",
                gym_email="admin@ironparadise.com",
                terms_conditions="Welcome to Iron Paradise Gym. Please follow all gym rules and regulations."
            )
            # Add admission fee to settings
            settings_dict = prepare_for_mongo(default_settings.dict())
            settings_dict['admission_fee'] = 1500.0  # Default admission fee, admin can change
            await db.gym_settings.insert_one(settings_dict)
            settings_dict = prepare_for_mongo(default_settings.dict())
            await db.gym_settings.insert_one(settings_dict)
            return default_settings
        
        return GymSettings(**parse_from_mongo(settings))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings", response_model=GymSettings)
async def update_gym_settings(
    settings_update: SettingsUpdate, 
    current_user: User = Depends(get_current_active_user)
):
    try:
        # Get current settings
        current_settings = await db.gym_settings.find_one()
        if not current_settings:
            raise HTTPException(status_code=404, detail="Settings not found")
        
        # Update settings
        update_data = {k: v for k, v in settings_update.dict().items() if v is not None}
        update_data['updated_by'] = current_user.username
        update_data['updated_at'] = datetime.now(timezone.utc)
        
        update_data = prepare_for_mongo(update_data)
        
        await db.gym_settings.update_one(
            {"id": current_settings["id"]},
            {"$set": update_data}
        )
        
        # Get updated settings
        updated_settings = await db.gym_settings.find_one({"id": current_settings["id"]})
        return GymSettings(**parse_from_mongo(updated_settings))
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings/admission-fee")
async def update_admission_fee(
    admission_fee_data: dict,
    current_admin: User = Depends(require_admin_role)
):
    """Update admission fee for monthly membership (admin only)"""
    try:
        admission_fee = admission_fee_data.get("amount")
        if admission_fee is None or admission_fee < 0:
            raise HTTPException(status_code=400, detail="Invalid admission fee amount")
        
        # Update or create admission fee setting
        await db.gym_settings.update_one(
            {"setting_name": "admission_fee"},
            {
                "$set": {
                    "setting_name": "admission_fee",
                    "amount": float(admission_fee),
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": current_admin.id
                }
            },
            upsert=True
        )
        
        # Also update main settings document
        await db.settings.update_one(
            {"id": "gym_settings"},
            {"$set": {"admission_fee": float(admission_fee)}},
            upsert=True
        )
        
        # Send notification
        await send_system_notification(
            "Admission Fee Updated",
            f"Monthly membership admission fee updated to ₹{admission_fee} by {current_admin.full_name}",
            "info"
        )
        
        return {
            "message": "Admission fee updated successfully",
            "admission_fee": float(admission_fee)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/settings/admission-fee")
async def get_admission_fee_setting(current_user: User = Depends(get_current_active_user)):
    """Get current admission fee for monthly membership"""
    try:
        admission_fee = await get_admission_fee()
        return {
            "amount": admission_fee,
            "applies_to": "monthly_membership_only",
            "description": "One-time admission fee applicable only for monthly membership plans"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/settings/bank-account")
async def get_bank_account_settings(current_user: User = Depends(get_current_active_user)):
    """Get bank account details for payments"""
    try:
        settings = await db.gym_settings.find_one({"setting_name": "bank_account"})
        if settings and "account_details" in settings:
            return settings["account_details"]
        
        # Return default bank account (to be configured by admin)
        return {
            "account_name": "Electroforum",
            "account_number": "123456789012",
            "ifsc_code": "BANK0001234",
            "bank_name": "State Bank of India",
            "upi_id": "electroforum@paytm"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/settings/reminder-template")
async def get_reminder_template(current_user: User = Depends(get_current_active_user)):
    """Get current reminder message template"""
    try:
        template = await db.gym_settings.find_one({"setting_name": "reminder_template"})
        if template and "message_template" in template:
            return template["message_template"]
        
        # Return default template
        return {
            "subject": "🏋️ Iron Paradise Gym - Membership Renewal Reminder",
            "message": """Hi {member_name},

Your {membership_type} membership expires {urgency} on {expiry_date}.

⚠️ Please renew immediately to continue enjoying our gym facilities.

💳 PAYMENT OPTIONS:

🏦 Bank Transfer:
Account Name: {account_name}
Account Number: {account_number}
IFSC Code: {ifsc_code}
Bank: {bank_name}

📱 UPI Payment:
UPI ID: {upi_id}

📍 Or visit our gym reception for instant renewal.

After payment, please share the receipt on WhatsApp or show at reception for membership activation.

Thank you for choosing Iron Paradise Gym! 💪

- Iron Paradise Gym Team""",
            "variables": ["member_name", "membership_type", "urgency", "expiry_date", "account_name", "account_number", "ifsc_code", "bank_name", "upi_id"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings/reminder-template")
async def update_reminder_template(
    template_data: dict,
    current_user: User = Depends(get_current_active_user)
):
    """Update reminder message template (admin/manager only)"""
    try:
        # Check if user has permission (admin or manager)
        if current_user.role not in ["admin", "manager"]:
            raise HTTPException(status_code=403, detail="Admin or Manager access required")
        
        message_template = {
            "subject": template_data.get("subject", "Membership Renewal Reminder"),
            "message": template_data.get("message", ""),
            "variables": template_data.get("variables", []),
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_user.id
        }
        
        await db.gym_settings.update_one(
            {"setting_name": "reminder_template"},
            {
                "$set": {
                    "setting_name": "reminder_template",
                    "message_template": message_template
                }
            },
            upsert=True
        )
        
        await send_system_notification(
            "Reminder template updated",
            f"WhatsApp reminder message template updated by {current_user.full_name}",
            "info"
        )
        
        return {"message": "Reminder template updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings/bank-account")
async def update_bank_account_settings(
    account_data: dict,
    current_admin: User = Depends(require_admin_role)
):
    """Update bank account details (admin only)"""
    try:
        account_details = {
            "account_name": account_data.get("account_name", "Electroforum"),
            "account_number": account_data.get("account_number"),
            "ifsc_code": account_data.get("ifsc_code"),
            "bank_name": account_data.get("bank_name"),
            "upi_id": account_data.get("upi_id"),
            "updated_at": datetime.now(timezone.utc),
            "updated_by": current_admin.id
        }
        
        await db.gym_settings.update_one(
            {"setting_name": "bank_account"},
            {
                "$set": {
                    "setting_name": "bank_account",
                    "account_details": account_details
                }
            },
            upsert=True
        )
        
        await send_system_notification(
            "Bank account details updated",
            f"Payment account information updated by {current_admin.full_name}",
            "info"
        )
        
        return {"message": "Bank account details updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.put("/settings/membership-rates")
async def update_membership_rates(
    rates_data: dict,
    current_admin: User = Depends(require_admin_role)
):
    """Update membership rates (admin only)"""
    try:
        rates = rates_data.get("rates", {})
        
        # Validate rates
        required_types = ["MONTHLY", "QUARTERLY", "SIX_MONTHLY"]
        for rate_type in required_types:
            if rate_type not in rates or rates[rate_type] < 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid or missing rate for {rate_type}"
                )
        
        # Update rates setting
        await db.gym_settings.update_one(
            {"setting_name": "membership_rates"},
            {
                "$set": {
                    "setting_name": "membership_rates",
                    "rates": rates,
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": current_admin.id
                }
            },
            upsert=True
        )
        
        # Also update main settings document
        await db.settings.update_one(
            {"id": "gym_settings"},
            {"$set": {"membership_rates": {
                "monthly": rates["MONTHLY"],
                "quarterly": rates["QUARTERLY"], 
                "six_monthly": rates["SIX_MONTHLY"]
            }}},
            upsert=True
        )
        
        # Send notification
        await send_system_notification(
            "Membership Rates Updated",
            f"Membership pricing updated by {current_admin.full_name}",
            "info"
        )
        
        return {
            "message": "Membership rates updated successfully",
            "rates": rates
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# Real-time Notification System
async def send_system_notification(title: str, message: str, type: str, user_id: str = None):
    """Send system notification"""
    try:
        notification = SystemNotification(
            title=title,
            message=message,
            type=type,
            user_id=user_id
        )
        
        notification_dict = prepare_for_mongo(notification.dict())
        await db.notifications.insert_one(notification_dict)
        
        # TODO: Send via WebSocket to connected clients
        logger.info(f"Notification sent: {title}")
        
    except Exception as e:
        logger.error(f"Error sending notification: {e}")

@api_router.get("/notifications", response_model=List[SystemNotification])
async def get_notifications(
    current_user: User = Depends(get_current_active_user),
    limit: int = 50
):
    try:
        # Get notifications for current user or broadcast notifications
        query = {
            "$or": [
                {"user_id": current_user.id},
                {"user_id": None}  # Broadcast notifications
            ]
        }
        
        notifications = await db.notifications.find(query).sort("created_at", -1).limit(limit).to_list(limit)
        return [SystemNotification(**parse_from_mongo(notif)) for notif in notifications]
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_active_user)
):
    try:
        result = await db.notifications.update_one(
            {"id": notification_id},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"message": "Notification marked as read"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.patch("/notifications/mark-all-read")
async def mark_all_notifications_read(current_user: User = Depends(get_current_active_user)):
    """Mark all notifications as read for current user"""
    try:
        result = await db.notifications.update_many(
            {"user_id": current_user.id, "read": False},
            {"$set": {"read": True, "read_at": datetime.now(timezone.utc)}}
        )
        
        return {
            "message": "All notifications marked as read",
            "updated_count": result.modified_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/notifications/clear-all")
async def clear_all_notifications(current_user: User = Depends(get_current_active_user)):
    """Clear all notifications for current user"""
    try:
        result = await db.notifications.delete_many({"user_id": current_user.id})
        
        return {
            "message": "All notifications cleared",
            "deleted_count": result.deleted_count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Delete a specific notification"""
    try:
        result = await db.notifications.delete_one({
            "id": notification_id,
            "user_id": current_user.id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        
        return {"message": "Notification deleted successfully"}
    except Exception as e:
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
        logger.info("🚀 Starting Iron Paradise Gym initialization...")
        
        # Initialize default permissions
        await initialize_default_permissions()
        logger.info("✅ Default permissions initialized")
        
        # Initialize default payment gateways
        await initialize_default_payment_gateways()
        logger.info("✅ Default payment gateways initialized")
        
        # Initialize receipt templates
        await initialize_receipt_templates()
        logger.info("✅ Receipt templates initialized")
        
        # Create default admin user ONLY if no admin exists
        logger.info("🔍 Checking for existing admin users...")
        admin_count = await db.users.count_documents({"role": "admin"})
        logger.info(f"📊 Found {admin_count} admin users")
        
        # Log existing admin users for debugging
        if admin_count > 0:
            admin_users = await db.users.find({"role": "admin"}).to_list(10)
            for admin in admin_users:
                logger.info(f"🔑 Admin user found: {admin.get('username')} ({admin.get('email')})")
        
        # Create test admin user for testing purposes
        test_admin_exists = await db.users.find_one({"username": "test_admin"})
        if not test_admin_exists:
            logger.info("🧪 Creating test admin user for testing purposes...")
            test_admin = User(
                username="test_admin",
                email="test@ironparadise.com", 
                full_name="Test Administrator",
                role=UserRole.ADMIN
            )
            
            user_dict = prepare_for_mongo(test_admin.dict())
            user_dict['hashed_password'] = get_password_hash("TestPass123!")
            
            await db.users.insert_one(user_dict)
            await update_user_permissions(test_admin.id)
            
            logger.info("🔐 TEST ADMIN CREATED:")
            logger.info("Username: test_admin")
            logger.info("Password: TestPass123!")
        
        if admin_count == 0:
            # Create secure admin setup
            admin_user = User(
                username="gym_admin",
                email="admin@ironparadise.com", 
                full_name="Gym Administrator",
                role=UserRole.ADMIN
            )
            
            user_dict = prepare_for_mongo(admin_user.dict())
            # Use a secure temporary password - admin should change this immediately
            user_dict['hashed_password'] = get_password_hash("IronParadise@2024")
            
            await db.users.insert_one(user_dict)
            await update_user_permissions(admin_user.id)
            
            logger.info("🔐 SECURE ADMIN CREATED:")
            logger.info("Username: gym_admin")
            logger.info("Password: IronParadise@2024") 
            logger.info("⚠️  CHANGE PASSWORD IMMEDIATELY AFTER FIRST LOGIN!")
            
            # Send system notification
            await send_system_notification(
                "System Initialized",
                "Iron Paradise Gym management system is ready. Please change admin password.",
                "warning"
            )
        
        # Initialize reminder service
        reminder_service_instance = init_reminder_service(client, os.environ['DB_NAME'])
        reminder_service_instance.start()
        logger.info("Reminder service started successfully")
        
    except Exception as e:
        logger.error(f"Failed to start services: {e}")

async def initialize_default_payment_gateways():
    """Initialize default payment gateways"""
    try:
        default_gateways = [
            {
                "id": str(uuid.uuid4()),
                "name": "Razorpay",
                "provider": "razorpay",
                "is_enabled": True,
                "supported_methods": ["card", "netbanking", "wallet", "upi"],
                "fees_percentage": 2.5,
                "currency": "INR",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "name": "PayU",
                "provider": "payu",
                "is_enabled": True,
                "supported_methods": ["card", "netbanking", "wallet", "upi"],
                "fees_percentage": 2.3,
                "currency": "INR",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Google Pay",
                "provider": "google_pay",
                "is_enabled": True,
                "supported_methods": ["upi", "wallet"],
                "fees_percentage": 1.5,
                "currency": "INR",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Paytm",
                "provider": "paytm",
                "is_enabled": True,
                "supported_methods": ["card", "netbanking", "wallet", "upi"],
                "fees_percentage": 2.0,
                "currency": "INR",
                "created_at": datetime.now(timezone.utc)
            },
            {
                "id": str(uuid.uuid4()),
                "name": "PhonePe",
                "provider": "phonepe",
                "is_enabled": True,
                "supported_methods": ["card", "netbanking", "wallet", "upi"],
                "fees_percentage": 1.5,
                "currency": "INR",
                "created_at": datetime.now(timezone.utc)
            }
        ]
        
        for gateway in default_gateways:
            existing = await db.payment_gateways.find_one({"provider": gateway["provider"]})
            if not existing:
                await db.payment_gateways.insert_one(gateway)
                logger.info(f"Created payment gateway: {gateway['name']}")
                
    except Exception as e:
        logger.error(f"Error initializing payment gateways: {e}")
        raise

async def initialize_receipt_templates():
    """Initialize default receipt templates"""
    try:
        default_template = {
            "id": str(uuid.uuid4()),
            "name": "Default Receipt Template",
            "is_default": True,
            "template_type": "payment_receipt",
            "header": {
                "gym_name": "Iron Paradise Gym",
                "gym_logo": "/images/gym-logo.png",
                "address": "123 Fitness Street, Gym City, 123456",
                "phone": "+91-9876543210",
                "email": "info@ironparadise.com",
                "website": "www.ironparadise.com"
            },
            "styles": {
                "primary_color": "#2563eb",
                "secondary_color": "#64748b",
                "font_family": "Arial, sans-serif",
                "font_size": "14px"
            },
            "sections": {
                "show_payment_details": True,
                "show_member_info": True,
                "show_service_details": True,
                "show_taxes": True,
                "show_terms": True
            },
            "footer": {
                "thank_you_message": "Thank you for choosing Iron Paradise Gym!",
                "terms_text": "All payments are non-refundable. Terms and conditions apply.",
                "contact_info": "For queries, contact us at info@ironparadise.com"
            },
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
        
        existing = await db.receipt_templates.find_one({"is_default": True})
        if not existing:
            await db.receipt_templates.insert_one(default_template)
            logger.info("Created default receipt template")
            
    except Exception as e:
        logger.error(f"Error initializing receipt templates: {e}")
        raise

# Receipt Register Management API
@app.get("/api/receipts/register")
async def get_receipt_register(current_user: User = Depends(get_current_active_user)):
    """Get all stored receipts in register"""
    try:
        receipts = await db.receipts.find({"status": "active"}).sort("generated_at", -1).to_list(1000)
        
        # Clean receipts data for serialization
        cleaned_receipts = []
        for receipt in receipts:
            cleaned_receipt = parse_from_mongo(receipt.copy())
            # Ensure required fields exist
            cleaned_receipt.setdefault('id', str(uuid.uuid4()))
            cleaned_receipt.setdefault('member_name', 'Unknown')
            cleaned_receipt.setdefault('payment_amount', 0)
            cleaned_receipt.setdefault('payment_method', 'cash')
            cleaned_receipt.setdefault('generated_at', datetime.now(timezone.utc).isoformat())
            
            # Convert datetime to string if needed
            if isinstance(cleaned_receipt.get('generated_at'), datetime):
                cleaned_receipt['generated_at'] = cleaned_receipt['generated_at'].isoformat()
            
            cleaned_receipts.append(cleaned_receipt)
        
        return cleaned_receipts
    except Exception as e:
        logger.error(f"Error fetching receipts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/receipts/{receipt_id}")
async def get_receipt_by_id(receipt_id: str, current_user: User = Depends(get_current_active_user)):
    """Get specific receipt by ID"""
    try:
        receipt = await db.receipts.find_one({"id": receipt_id, "status": "active"})
        if not receipt:
            raise HTTPException(status_code=404, detail="Receipt not found")
        return receipt
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.delete("/receipts/{receipt_id}")
async def delete_receipt(receipt_id: str, current_admin: User = Depends(require_admin_role)):
    """Delete receipt from register (admin only)"""
    try:
        # Check if receipt exists
        receipt = await db.receipts.find_one({"id": receipt_id, "status": "active"})
        if not receipt:
            raise HTTPException(status_code=404, detail="Receipt not found")
        
        # Soft delete - mark as deleted instead of removing
        await db.receipts.update_one(
            {"id": receipt_id},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_by": current_admin.id,
                    "deleted_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Send notification
        await send_system_notification(
            "Receipt Deleted",
            f"Receipt for {receipt.get('member_name', 'Unknown')} - ₹{receipt.get('payment_amount', 0)} deleted by {current_admin.full_name}",
            "warning"
        )
        
        return {"message": "Receipt deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/receipts/bulk-delete")
async def bulk_delete_receipts(
    receipt_data: dict,
    current_admin: User = Depends(require_admin_role)
):
    """Bulk delete receipts (admin only)"""
    try:
        receipt_ids = receipt_data.get("receipt_ids", [])
        if not receipt_ids:
            raise HTTPException(status_code=400, detail="No receipt IDs provided")
        
        if len(receipt_ids) > 50:
            raise HTTPException(status_code=400, detail="Cannot delete more than 50 receipts at once")
        
        # Bulk soft delete
        result = await db.receipts.update_many(
            {"id": {"$in": receipt_ids}, "status": "active"},
            {
                "$set": {
                    "status": "deleted",
                    "deleted_by": current_admin.id,
                    "deleted_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Send notification
        await send_system_notification(
            f"Bulk delete: {result.modified_count} receipts",
            f"Receipts deleted by {current_admin.full_name}",
            "warning"
        )
        
        return {
            "message": f"Successfully deleted {result.modified_count} receipts",
            "deleted_count": result.modified_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Receipt Management API
@app.get("/api/receipts/templates")
async def get_receipt_templates(current_user: User = Depends(get_current_active_user)):
    """Get all receipt templates"""
    try:
        templates = await db.receipt_templates.find().to_list(1000)
        
        # Clean templates data for serialization
        cleaned_templates = []
        for template in templates:
            cleaned_template = parse_from_mongo(template.copy())
            cleaned_templates.append(cleaned_template)
        
        return cleaned_templates
    except Exception as e:
        logger.error(f"Error fetching receipt templates: {e}")
        # Return default template if none exist
        return [{
            "id": "default",
            "name": "Default Template",
            "is_default": True
        }]

@app.get("/api/receipts/templates/{template_id}")
async def get_receipt_template(template_id: str, current_user: User = Depends(get_current_active_user)):
    """Get specific receipt template"""
    try:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        template = await db.receipt_templates.find_one({"id": template_id})
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return template
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/receipts/templates")
async def create_receipt_template(template_data: dict, current_user: User = Depends(get_current_active_user)):
    """Create new receipt template"""
    try:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        template = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
            **template_data
        }
        
        await db.receipt_templates.insert_one(template)
        return {"message": "Template created successfully", "template_id": template["id"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/receipts/templates/{template_id}")
async def update_receipt_template(template_id: str, template_data: dict, current_user: User = Depends(get_current_active_user)):
    """Update receipt template"""
    try:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        template_data["updated_at"] = datetime.now(timezone.utc)
        
        result = await db.receipt_templates.update_one(
            {"id": template_id},
            {"$set": template_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {"message": "Template updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/receipts/templates/{template_id}")
async def delete_receipt_template(template_id: str, current_user: User = Depends(get_current_active_user)):
    """Delete receipt template"""
    try:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        # Check if it's the default template
        template = await db.receipt_templates.find_one({"id": template_id})
        if template and template.get("is_default"):
            raise HTTPException(status_code=400, detail="Cannot delete default template")
        
        result = await db.receipt_templates.delete_one({"id": template_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Template not found")
        
        return {"message": "Template deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/receipts/generate/{payment_id}")
async def generate_receipt(
    payment_id: str, 
    template_id: str = None, 
    current_user: User = Depends(get_current_active_user)
):
    """Generate receipt for payment - Real-time functionality with storage"""
    try:
        # Get payment details
        payment = await db.payments.find_one({"id": payment_id})
        if not payment:
            # Try to find by transaction_id as backup
            payment = await db.payments.find_one({"transaction_id": payment_id})
            if not payment:
                raise HTTPException(status_code=404, detail="Payment not found")
        
        # Get member details
        member = await db.members.find_one({"id": payment["member_id"]})
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        
        # Check if receipt already exists for this payment
        existing_receipt = await db.receipts.find_one({"payment_id": payment["id"]})
        if existing_receipt:
            return {
                "message": "Receipt already exists",
                "receipt_id": existing_receipt["id"],
                "receipt_html": existing_receipt["receipt_html"],
                "payment_amount": payment.get("amount", 0),
                "member_name": member.get("name", "Unknown"),
                "generated_at": existing_receipt["generated_at"]
            }
        
        # Get template
        if template_id:
            template = await db.receipt_templates.find_one({"id": template_id})
        else:
            template = await db.receipt_templates.find_one({"is_default": True})
        
        if not template:
            # Create a basic template if none exists
            template = {
                "id": str(uuid.uuid4()),
                "name": "Basic Receipt",
                "is_default": True,
                "header": {
                    "gym_name": "Iron Paradise Gym",
                    "address": "123 Fitness Street, Gym City, 123456",
                    "phone": "+91-9876543210",
                    "email": "info@ironparadise.com",
                    "website": "www.ironparadise.com"
                },
                "styles": {
                    "primary_color": "#2563eb",
                    "secondary_color": "#64748b",
                    "font_family": "Arial, sans-serif",
                    "font_size": "14px"
                },
                "sections": {
                    "show_payment_details": True,
                    "show_member_info": True,
                    "show_service_details": True,
                    "show_terms": True
                },
                "footer": {
                    "thank_you_message": "Thank you for choosing Iron Paradise Gym!",
                    "terms_text": "All payments are non-refundable. Terms and conditions apply.",
                    "contact_info": "For queries, contact us at info@ironparadise.com"
                }
            }
        
        # Generate receipt HTML
        receipt_html = await generate_receipt_html(payment, member, template)
        
        # Store receipt record in receipt register
        receipt_record = {
            "id": str(uuid.uuid4()),
            "payment_id": payment["id"],
            "member_id": payment["member_id"],
            "member_name": member.get("name", "Unknown"),
            "payment_amount": payment.get("amount", 0),
            "payment_method": payment.get("method", "cash"),
            "template_id": template["id"],
            "receipt_html": receipt_html,
            "generated_by": current_user.id,
            "generated_at": datetime.now(timezone.utc),
            "status": "active"
        }
        
        await db.receipts.insert_one(receipt_record)
        
        # Send notification
        await send_system_notification(
            "Receipt Generated",
            f"Receipt generated for {member.get('name')} - ₹{payment.get('amount', 0)} by {current_user.full_name}",
            "info"
        )
        
        return {
            "message": "Receipt generated and stored successfully",
            "receipt_id": receipt_record["id"],
            "receipt_html": receipt_html,
            "payment_amount": payment.get("amount", 0),
            "member_name": member.get("name", "Unknown")
        }
    except Exception as e:
        logger.error(f"Error generating receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/payments/{payment_id}/receipt")
async def generate_payment_receipt(
    payment_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """Quick receipt generation for a payment"""
    try:
        return await generate_receipt(payment_id, None, current_user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def generate_receipt_html(payment: dict, member: dict, template: dict) -> str:
    """Generate HTML receipt from template"""
    try:
        # Format payment date safely
        payment_date = payment.get('payment_date', datetime.now(timezone.utc))
        if isinstance(payment_date, str):
            payment_date = datetime.fromisoformat(payment_date)
        formatted_date = payment_date.strftime('%Y-%m-%d %H:%M:%S')
        
        # Build member info section
        member_info_section = ""
        if template['sections']['show_member_info']:
            member_info_section = f"""
                <div class="section">
                    <div class="section-title">Member Information</div>
                    <div class="info-row">
                        <span class="info-label">Name:</span>
                        <span class="info-value">{member.get("name", "N/A")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Email:</span>
                        <span class="info-value">{member.get("email", "N/A")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Phone:</span>
                        <span class="info-value">{member.get("phone", "N/A")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Member ID:</span>
                        <span class="info-value">{member.get("id", "N/A")}</span>
                    </div>
                </div>
            """
        
        # Build service details section
        service_details_section = ""
        if template['sections']['show_service_details']:
            service_details_section = f"""
                <div class="section">
                    <div class="section-title">Service Details</div>
                    <div class="info-row">
                        <span class="info-label">Service:</span>
                        <span class="info-value">{payment.get("description", "Gym Service")}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Amount:</span>
                        <span class="info-value">₹{payment.get("amount", 0)}</span>
                    </div>
                </div>
            """
        
        # Build terms section
        terms_section = ""
        if template['sections']['show_terms']:
            terms_section = f'<div class="terms">{template["footer"]["terms_text"]}</div>'
        
        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Payment Receipt</title>
            <style>
                body {{
                    font-family: {template['styles']['font_family']};
                    font-size: {template['styles']['font_size']};
                    margin: 0;
                    padding: 20px;
                    background-color: #f5f5f5;
                }}
                .receipt-container {{
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: white;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }}
                .header {{
                    text-align: center;
                    border-bottom: 2px solid {template['styles']['primary_color']};
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }}
                .gym-name {{
                    color: {template['styles']['primary_color']};
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }}
                .gym-info {{
                    color: {template['styles']['secondary_color']};
                    font-size: 14px;
                    line-height: 1.6;
                }}
                .section {{
                    margin-bottom: 25px;
                }}
                .section-title {{
                    color: {template['styles']['primary_color']};
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 5px;
                }}
                .info-row {{
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    border-bottom: 1px dotted #ddd;
                }}
                .info-label {{
                    font-weight: bold;
                    color: {template['styles']['secondary_color']};
                }}
                .info-value {{
                    color: #333;
                }}
                .amount-total {{
                    background-color: {template['styles']['primary_color']};
                    color: white;
                    padding: 15px;
                    border-radius: 5px;
                    text-align: center;
                    font-size: 20px;
                    font-weight: bold;
                    margin: 20px 0;
                }}
                .footer {{
                    text-align: center;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 2px solid {template['styles']['primary_color']};
                }}
                .thank-you {{
                    color: {template['styles']['primary_color']};
                    font-size: 18px;
                    font-weight: bold;
                    margin-bottom: 15px;
                }}
                .terms {{
                    color: {template['styles']['secondary_color']};
                    font-size: 12px;
                    line-height: 1.5;
                    margin-bottom: 10px;
                }}
                .contact-info {{
                    color: {template['styles']['secondary_color']};
                    font-size: 12px;
                }}
                @media print {{
                    body {{ background-color: white; }}
                    .receipt-container {{ box-shadow: none; }}
                }}
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <div class="header">
                    <div class="gym-name">{template['header']['gym_name']}</div>
                    <div class="gym-info">
                        {template['header']['address']}<br>
                        Phone: {template['header']['phone']}<br>
                        Email: {template['header']['email']}<br>
                        Website: {template['header']['website']}
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">Payment Receipt</div>
                    <div class="info-row">
                        <span class="info-label">Receipt ID:</span>
                        <span class="info-value">{payment['id']}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Payment Date:</span>
                        <span class="info-value">{formatted_date}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Payment Method:</span>
                        <span class="info-value">{payment.get('payment_method', 'Online')}</span>
                    </div>
                </div>
                
                {member_info_section}
                
                {service_details_section}
                
                <div class="amount-total">
                    Total Paid: ₹{payment.get('amount', 0)}
                </div>
                
                <div class="footer">
                    <div class="thank-you">{template['footer']['thank_you_message']}</div>
                    {terms_section}
                    <div class="contact-info">{template['footer']['contact_info']}</div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html_template
        
    except Exception as e:
        logger.error(f"Error generating receipt HTML: {e}")
        raise

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
