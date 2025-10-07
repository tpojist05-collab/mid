import os
import logging
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from motor.motor_asyncio import AsyncIOMotorClient
from twilio.rest import Client as TwilioClient
from typing import List, Dict, Any
import asyncio

logger = logging.getLogger(__name__)

class ReminderService:
    def __init__(self, mongo_client: AsyncIOMotorClient, db_name: str):
        self.db = mongo_client[db_name]
        self.scheduler = AsyncIOScheduler()
        
        # Initialize Twilio client
        self.twilio_client = None
        if all([
            os.environ.get('TWILIO_ACCOUNT_SID'),
            os.environ.get('TWILIO_AUTH_TOKEN'),
            os.environ.get('TWILIO_PHONE_NUMBER')
        ]):
            try:
                self.twilio_client = TwilioClient(
                    os.environ['TWILIO_ACCOUNT_SID'],
                    os.environ['TWILIO_AUTH_TOKEN']
                )
                self.twilio_phone = os.environ['TWILIO_PHONE_NUMBER']
                logger.info("Twilio SMS service initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Twilio: {e}")
        else:
            logger.warning("Twilio credentials not configured - SMS reminders disabled")

    def start(self):
        """Start the reminder scheduler"""
        try:
            # Schedule frequent reminder checks every 2 hours for real-time functionality
            self.scheduler.add_job(
                self.check_and_send_reminders,
                trigger=CronTrigger(minute=0, second=0),  # Every hour at minute 0
                id='hourly_reminder_check',
                replace_existing=True,
                max_instances=1
            )
            
            # Schedule daily reminder check at 9 AM
            self.scheduler.add_job(
                self.check_and_send_reminders,
                trigger=CronTrigger(hour=9, minute=0),
                id='daily_reminder_check',
                replace_existing=True,
                max_instances=1
            )
            
            # Schedule evening reminder check at 6 PM
            self.scheduler.add_job(
                self.check_and_send_reminders,
                trigger=CronTrigger(hour=18, minute=0),
                id='evening_reminder_check',
                replace_existing=True,
                max_instances=1
            )
            
            # Initial reminder check on startup
            self.scheduler.add_job(
                self.check_and_send_reminders,
                'date',
                run_date=datetime.now(timezone.utc) + timedelta(seconds=30),
                id='startup_reminder_check',
                max_instances=1
            )
            
            self.scheduler.start()
            logger.info("Real-time reminder service started successfully with hourly checks")
        except Exception as e:
            logger.error(f"Failed to start reminder service: {e}")

    def stop(self):
        """Stop the reminder scheduler"""
        try:
            if self.scheduler.running:
                self.scheduler.shutdown()
            logger.info("Reminder service stopped")
        except Exception as e:
            logger.error(f"Error stopping reminder service: {e}")

    async def check_and_send_reminders(self):
        """Check for memberships expiring soon and send reminders"""
        try:
            logger.info("Starting reminder check...")
            
            # Get members with memberships expiring in 7, 3, and 1 days
            reminders_sent = 0
            
            for days in [7, 3, 1]:
                members = await self.get_expiring_members(days)
                for member in members:
                    if await self.should_send_reminder(member, days):
                        success = await self.send_reminder(member, days)
                        if success:
                            await self.log_reminder_sent(member['id'], days)
                            reminders_sent += 1
            
            logger.info(f"Reminder check completed. {reminders_sent} reminders sent.")
            
        except Exception as e:
            logger.error(f"Error in reminder check: {e}")

    async def get_expiring_members(self, days: int) -> List[Dict[str, Any]]:
        """Get members whose membership expires in specified days"""
        try:
            target_date = datetime.now(timezone.utc) + timedelta(days=days)
            start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
            end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            # Find members expiring on the target date
            members = await self.db.members.find({
                "membership_end": {
                    "$gte": start_of_day.isoformat(),
                    "$lte": end_of_day.isoformat()
                },
                "current_payment_status": {"$in": ["paid", "pending"]}  # Don't remind expired members
            }).to_list(100)
            
            return members
            
        except Exception as e:
            logger.error(f"Error getting expiring members: {e}")
            return []

    async def should_send_reminder(self, member: Dict[str, Any], days: int) -> bool:
        """Check if we should send a reminder to this member"""
        try:
            # Check if we already sent a reminder for this expiry period today
            today = datetime.now(timezone.utc).date()
            existing_reminder = await self.db.reminder_logs.find_one({
                "member_id": member["id"],
                "days_before_expiry": days,
                "sent_date": today.isoformat(),
                "membership_end": member["membership_end"]
            })
            
            return existing_reminder is None
            
        except Exception as e:
            logger.error(f"Error checking reminder status: {e}")
            return False

    async def send_reminder(self, member: Dict[str, Any], days: int) -> bool:
        """Send reminder to member via WhatsApp and SMS"""
        try:
            message = self.create_reminder_message(member, days)
            
            # Try WhatsApp first
            if self.twilio_client:
                whatsapp_success = await self.send_whatsapp(member['phone'], message)
                if whatsapp_success:
                    logger.info(f"WhatsApp reminder sent to {member['name']} ({member['phone']})")
                    return True
                
                # Fallback to SMS if WhatsApp fails
                sms_success = await self.send_sms(member['phone'], message)
                if sms_success:
                    logger.info(f"SMS reminder sent to {member['name']} ({member['phone']})")
                    return True
            
            # Fallback to log only
            logger.info(f"Reminder for {member['name']}: {message}")
            return True  # Consider logged reminder as "sent"
            
        except Exception as e:
            logger.error(f"Error sending reminder to {member['name']}: {e}")
            return False

    async def create_reminder_message(self, member: Dict[str, Any], days: int) -> str:
        """Create reminder message text with payment details"""
        try:
            membership_type = member.get('membership_type', 'monthly').replace('_', ' ').title()
            expiry_date = datetime.fromisoformat(member['membership_end']).strftime('%d %b %Y')
            
            if days == 7:
                urgency = "soon"
            elif days == 3:
                urgency = "very soon"
            else:
                urgency = "tomorrow"
            
            # Get bank account details from database
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
                    "account_number": "Not Available",
                    "ifsc_code": "Not Available", 
                    "bank_name": "Contact Admin",
                    "upi_id": "Contact Admin"
                }
            
            return f"""🏋️ Iron Paradise Gym - Membership Renewal Reminder

Hi {member['name']},

Your {membership_type} membership expires {urgency} on {expiry_date}.

⚠️ Please renew immediately to continue enjoying our gym facilities.

💳 PAYMENT OPTIONS:

🏦 Bank Transfer:
Account Name: {account['account_name']}
Account Number: {account['account_number']}
IFSC Code: {account['ifsc_code']}
Bank: {account['bank_name']}

📱 UPI Payment:
UPI ID: {account['upi_id']}

📍 Or visit our gym reception for instant renewal.

After payment, please share the receipt on WhatsApp or show at reception for membership activation.

Thank you for choosing Iron Paradise Gym! 💪

- Iron Paradise Gym Team"""
        except Exception as e:
            logger.error(f"Error creating reminder message: {e}")
            # Fallback simple message
            return f"""Hi {member['name']}, your gym membership expires soon. Please visit reception to renew. - Iron Paradise Gym"""

    async def send_whatsapp(self, phone_number: str, message: str) -> bool:
        """Send WhatsApp message using Twilio WhatsApp API"""
        try:
            # Clean phone number (remove spaces, add country code if needed)
            clean_phone = phone_number.replace(' ', '').replace('-', '')
            if not clean_phone.startswith('+'):
                if clean_phone.startswith('91'):
                    clean_phone = '+' + clean_phone
                elif clean_phone.startswith('0'):
                    clean_phone = '+91' + clean_phone[1:]
                else:
                    clean_phone = '+91' + clean_phone
            
            # Send WhatsApp message via Twilio using business number
            whatsapp_from = os.environ.get('TWILIO_WHATSAPP_FROM', f'whatsapp:{os.environ.get("WHATSAPP_BUSINESS_NUMBER", "+917099197780")}')
            message_instance = self.twilio_client.messages.create(
                body=message,
                from_=whatsapp_from,
                to=f'whatsapp:{clean_phone}'
            )
            
            logger.info(f"WhatsApp message sent successfully. SID: {message_instance.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send WhatsApp message to {phone_number}: {e}")
            return False

    async def send_sms(self, phone_number: str, message: str) -> bool:
        """Send SMS using Twilio"""
        try:
            # Clean phone number (remove spaces, add country code if needed)
            clean_phone = phone_number.replace(' ', '').replace('-', '')
            if not clean_phone.startswith('+'):
                if clean_phone.startswith('91'):
                    clean_phone = '+' + clean_phone
                elif clean_phone.startswith('0'):
                    clean_phone = '+91' + clean_phone[1:]
                else:
                    clean_phone = '+91' + clean_phone
            
            # Send SMS via Twilio
            message_instance = self.twilio_client.messages.create(
                body=message,
                from_=self.twilio_phone,
                to=clean_phone
            )
            
            logger.info(f"SMS sent successfully. SID: {message_instance.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send SMS to {phone_number}: {e}")
            return False

    async def log_reminder_sent(self, member_id: str, days: int):
        """Log that a reminder was sent"""
        try:
            log_entry = {
                "member_id": member_id,
                "days_before_expiry": days,
                "sent_date": datetime.now(timezone.utc).date().isoformat(),
                "sent_at": datetime.now(timezone.utc),
                "membership_end": (await self.db.members.find_one({"id": member_id}))["membership_end"]
            }
            
            await self.db.reminder_logs.insert_one(log_entry)
            
        except Exception as e:
            logger.error(f"Error logging reminder: {e}")

    async def send_manual_reminder(self, member_id: str) -> Dict[str, Any]:
        """Send manual reminder to a specific member"""
        try:
            member = await self.db.members.find_one({"id": member_id})
            if not member:
                return {"success": False, "error": "Member not found"}
            
            # Calculate days until expiry
            expiry_date = datetime.fromisoformat(member['membership_end'])
            if expiry_date.tzinfo is None:
                expiry_date = expiry_date.replace(tzinfo=timezone.utc)
            days_until_expiry = (expiry_date - datetime.now(timezone.utc)).days
            
            success = await self.send_reminder(member, days_until_expiry)
            
            if success:
                await self.log_reminder_sent(member_id, days_until_expiry)
                return {
                    "success": True, 
                    "message": f"Reminder sent to {member['name']}"
                }
            else:
                return {
                    "success": False, 
                    "error": "Failed to send reminder"
                }
                
        except Exception as e:
            logger.error(f"Error sending manual reminder: {e}")
            return {"success": False, "error": str(e)}

    async def get_reminder_history(self, member_id: str = None) -> List[Dict[str, Any]]:
        """Get reminder history for a member or all members"""
        try:
            query = {"member_id": member_id} if member_id else {}
            
            reminders = await self.db.reminder_logs.find(query).sort("sent_at", -1).to_list(100)
            
            # Enrich with member names
            for reminder in reminders:
                member = await self.db.members.find_one({"id": reminder["member_id"]})
                reminder["member_name"] = member["name"] if member else "Unknown"
            
            return reminders
            
        except Exception as e:
            logger.error(f"Error getting reminder history: {e}")
            return []

# Global reminder service instance
reminder_service: ReminderService = None

def init_reminder_service(mongo_client: AsyncIOMotorClient, db_name: str):
    """Initialize the global reminder service"""
    global reminder_service
    reminder_service = ReminderService(mongo_client, db_name)
    return reminder_service

def get_reminder_service() -> ReminderService:
    """Get the global reminder service instance"""
    return reminder_service