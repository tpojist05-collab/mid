import os
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
import urllib.parse
import asyncio

logger = logging.getLogger(__name__)

class DirectWhatsAppService:
    """Direct WhatsApp service without Twilio complications"""
    
    def __init__(self, db):
        self.db = db
        self.business_number = os.environ.get('WHATSAPP_BUSINESS_NUMBER', '+917099197780')
        self.business_name = os.environ.get('WHATSAPP_BUSINESS_NAME', 'Iron Paradise Gym')
        self.enabled = os.environ.get('WHATSAPP_ENABLED', 'true').lower() == 'true'
        
        logger.info(f"Direct WhatsApp Service initialized with business number: {self.business_number}")
    
    async def send_reminder(self, member: Dict[str, Any], days_before_expiry: int = 7) -> Dict[str, Any]:
        """Send WhatsApp reminder directly to member"""
        try:
            if not self.enabled:
                return {"success": False, "error": "WhatsApp service disabled"}
            
            # Create reminder message
            message = await self.create_reminder_message(member, days_before_expiry)
            
            # Get member phone number
            member_phone = self.clean_phone_number(member.get('phone', ''))
            if not member_phone:
                return {"success": False, "error": "Invalid phone number"}
            
            # Create WhatsApp link for direct sending
            whatsapp_link = self.create_whatsapp_link(member_phone, message)
            
            # Log the reminder attempt
            await self.log_reminder(member, message, whatsapp_link, days_before_expiry)
            
            return {
                "success": True,
                "message": f"WhatsApp reminder link created for {member['name']}",
                "whatsapp_link": whatsapp_link,
                "phone": member_phone,
                "message_content": message
            }
            
        except Exception as e:
            logger.error(f"Error sending WhatsApp reminder: {e}")
            return {"success": False, "error": str(e)}
    
    def create_whatsapp_link(self, phone: str, message: str) -> str:
        """Create direct WhatsApp link"""
        # Ensure phone number is in international format
        if not phone.startswith('+'):
            phone = '+91' + phone.lstrip('0')
        
        # Remove WhatsApp prefix if present
        phone = phone.replace('whatsapp:', '').replace('+', '')
        
        # URL encode the message
        encoded_message = urllib.parse.quote(message)
        
        # Create WhatsApp link
        whatsapp_link = f"https://wa.me/{phone}?text={encoded_message}"
        
        return whatsapp_link
    
    def clean_phone_number(self, phone: str) -> str:
        """Clean and validate phone number"""
        if not phone:
            return ""
        
        # Remove all non-digit characters except +
        import re
        phone = re.sub(r'[^\d+]', '', phone)
        
        # Add +91 if not present and number looks Indian
        if not phone.startswith('+'):
            if phone.startswith('91') and len(phone) == 12:
                phone = '+' + phone
            elif len(phone) == 10:
                phone = '+91' + phone
            else:
                phone = '+91' + phone.lstrip('0')
        
        return phone
    
    async def create_reminder_message(self, member: Dict[str, Any], days: int) -> str:
        """Create reminder message using editable template"""
        try:
            membership_type = member.get('membership_type', 'monthly').replace('_', ' ').title()
            
            # Parse expiry date
            expiry_date_str = member.get('membership_end', '')
            if expiry_date_str:
                try:
                    expiry_date = datetime.fromisoformat(expiry_date_str).strftime('%d %b %Y')
                except:
                    expiry_date = "Soon"
            else:
                expiry_date = "Soon"
            
            # Determine urgency
            if days == 0:
                urgency = "TODAY"
            elif days == 1:
                urgency = "TOMORROW"
            elif days <= 3:
                urgency = "very soon"
            elif days <= 7:
                urgency = "soon"
            else:
                urgency = f"in {days} days"
            
            # Get editable reminder template
            template_settings = await self.db.gym_settings.find_one({"setting_name": "reminder_template"})
            if template_settings and "message_template" in template_settings:
                message_template = template_settings["message_template"]["message"]
            else:
                # Default template
                message_template = """🏋️ {business_name} - Membership Renewal Reminder

Hi {member_name},

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

Thank you for choosing {business_name}! 💪

- {business_name} Team"""
            
            # Get bank account details
            try:
                bank_settings = await self.db.gym_settings.find_one({"setting_name": "bank_account"})
                if bank_settings and "account_details" in bank_settings:
                    account = bank_settings["account_details"]
                else:
                    # Default bank account details
                    account = {
                        "account_name": "Electroforum",
                        "account_number": "123456789012", 
                        "ifsc_code": "BANK0001234",
                        "bank_name": "State Bank of India",
                        "upi_id": "electroforum@paytm"
                    }
            except Exception as e:
                logger.error(f"Error fetching bank details: {e}")
                account = {
                    "account_name": "Electroforum",
                    "account_number": "Contact Admin",
                    "ifsc_code": "Contact Admin", 
                    "bank_name": "Contact Admin",
                    "upi_id": "Contact Admin"
                }
            
            # Format message with variables
            formatted_message = message_template.format(
                business_name=self.business_name,
                member_name=member['name'],
                membership_type=membership_type,
                urgency=urgency,
                expiry_date=expiry_date,
                account_name=account['account_name'],
                account_number=account['account_number'],
                ifsc_code=account['ifsc_code'],
                bank_name=account['bank_name'],
                upi_id=account['upi_id']
            )
            
            return formatted_message
            
        except Exception as e:
            logger.error(f"Error creating reminder message: {e}")
            # Fallback simple message
            return f"""Hi {member['name']}, your gym membership expires soon. Please visit {self.business_name} reception to renew. Contact: {self.business_number}"""
    
    async def log_reminder(self, member: Dict[str, Any], message: str, whatsapp_link: str, days_before_expiry: int):
        """Log reminder attempt in database"""
        try:
            reminder_log = {
                "id": f"reminder_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{member['id'][:8]}",
                "member_id": member['id'],
                "member_name": member['name'],
                "member_phone": member.get('phone', ''),
                "message_content": message,
                "whatsapp_link": whatsapp_link,
                "days_before_expiry": days_before_expiry,
                "sent_at": datetime.now(timezone.utc),
                "method": "direct_whatsapp",
                "status": "link_created",
                "business_number": self.business_number
            }
            
            await self.db.reminder_logs.insert_one(reminder_log)
            logger.info(f"Reminder logged for member {member['name']}")
            
        except Exception as e:
            logger.error(f"Error logging reminder: {e}")
    
    async def get_reminder_history(self, member_id: Optional[str] = None) -> list:
        """Get reminder history"""
        try:
            if member_id:
                query = {"member_id": member_id}
            else:
                query = {}
            
            history = await self.db.reminder_logs.find(query).sort("sent_at", -1).to_list(1000)
            return history
            
        except Exception as e:
            logger.error(f"Error fetching reminder history: {e}")
            return []

# Global instance
whatsapp_service_instance = None

async def initialize_whatsapp_service(db):
    """Initialize WhatsApp service"""
    global whatsapp_service_instance
    try:
        whatsapp_service_instance = DirectWhatsAppService(db)
        logger.info("Direct WhatsApp service initialized successfully")
        return whatsapp_service_instance
    except Exception as e:
        logger.error(f"Failed to initialize WhatsApp service: {e}")
        return None

def get_whatsapp_service():
    """Get the global WhatsApp service instance"""
    return whatsapp_service_instance