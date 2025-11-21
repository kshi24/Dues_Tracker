import requests
import json
from typing import List, Optional, Dict
from datetime import datetime, timedelta

class SlackMessagingService:
    """
    Comprehensive Slack messaging service for TAMID Dues Tracker
    Handles individual reminders, bulk notifications, payment confirmations, and automated scheduling
    """
    
    def __init__(self, webhook_url: str):
        """
        Initialize Slack service with webhook URL
        
        Args:
            webhook_url: Slack incoming webhook URL
        """
        self.webhook_url = webhook_url
    
    def send_message(self, text: str, blocks: Optional[List[dict]] = None) -> Dict:
        """
        Send a message to Slack channel
        
        Args:
            text: Plain text message (fallback)
            blocks: Optional Block Kit formatted message blocks
            
        Returns:
            Dict with success status and message
        """
        payload = {"text": text}
        if blocks:
            payload["blocks"] = blocks
        
        try:
            response = requests.post(
                self.webhook_url,
                data=json.dumps(payload),
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "message": "Message sent successfully" if response.status_code == 200 else f"Failed with status {response.status_code}"
            }
        except requests.exceptions.Timeout:
            return {
                "success": False,
                "status_code": 408,
                "message": "Request timed out"
            }
        except Exception as e:
            print(f"Error sending Slack message: {e}")
            return {
                "success": False,
                "status_code": 500,
                "message": str(e)
            }
    
    def send_individual_reminder(self, member_name: str, member_email: str, 
                                  amount_due: float, status: str = "Pending",
                                  due_date: Optional[str] = None) -> Dict:
        """
        Send payment reminder for a specific member
        
        Args:
            member_name: Name of the member
            member_email: Email of the member
            amount_due: Amount still owed
            status: Payment status (Pending/Overdue)
            due_date: Optional due date string
            
        Returns:
            Dict with send result
        """
        # Determine urgency level
        if status.lower() == "overdue":
            urgency = "🔴 OVERDUE"
            emoji = "🚨"
            color = "#dc2626"
        else:
            urgency = "⚠️ REMINDER"
            emoji = "💰"
            color = "#f59e0b"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} {urgency}: Dues Payment Needed",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Member:*\n{member_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Email:*\n{member_email}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Amount Due:*\n${amount_due:.2f}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Status:*\n{status}"
                    }
                ]
            }
        ]
        
        # Add due date if provided
        if due_date:
            blocks[1]["fields"].append({
                "type": "mrkdwn",
                "text": f"*Due Date:*\n{due_date}"
            })
        
        blocks.append({"type": "divider"})
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Sent on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
                }
            ]
        })
        
        text = f"{urgency}: {member_name} has ${amount_due:.2f} in dues {status.lower()}"
        return self.send_message(text, blocks)
    
    def send_bulk_reminder_summary(self, unpaid_members: List[Dict]) -> Dict:
        """
        Send summary of all unpaid members
        
        Args:
            unpaid_members: List of dicts with member info (name, class, amount_due, status)
            
        Returns:
            Dict with send result
        """
        if not unpaid_members:
            return {
                "success": False,
                "message": "No unpaid members to notify"
            }
        
        total_outstanding = sum(m['amount_due'] for m in unpaid_members)
        overdue_count = sum(1 for m in unpaid_members if m.get('status', '').lower() == 'overdue')
        pending_count = len(unpaid_members) - overdue_count
        
        # Create member list (limit to 20 to avoid message size issues)
        member_list = "\n".join([
            f"• *{m['name']}* ({m.get('class', 'N/A')}): ${m['amount_due']:.2f} - _{m['status']}_" 
            for m in unpaid_members[:20]
        ])
        
        if len(unpaid_members) > 20:
            member_list += f"\n_...and {len(unpaid_members) - 20} more members_"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📊 Bulk Dues Payment Reminder",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Summary:* {len(unpaid_members)} members have outstanding dues totaling *${total_outstanding:.2f}*\n\n"
                            f"🔴 Overdue: {overdue_count} members\n"
                            f"⚠️ Pending: {pending_count} members"
                }
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Members with Unpaid Dues:*\n{member_list}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Sent on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
                    }
                ]
            }
        ]
        
        text = f"Bulk Reminder: {len(unpaid_members)} members owe ${total_outstanding:.2f}"
        return self.send_message(text, blocks)
    
    def send_payment_confirmation(self, member_name: str, amount: float, 
                                   payment_method: str = "Square",
                                   transaction_id: Optional[str] = None) -> Dict:
        """
        Send confirmation when payment is received
        
        Args:
            member_name: Name of member who paid
            amount: Amount paid
            payment_method: Payment method used
            transaction_id: Optional transaction ID
            
        Returns:
            Dict with send result
        """
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "✅ Payment Received!",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Member:*\n{member_name}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Amount:*\n${amount:.2f}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Method:*\n{payment_method}"
                    }
                ]
            }
        ]
        
        if transaction_id:
            blocks[1]["fields"].append({
                "type": "mrkdwn",
                "text": f"*Transaction ID:*\n`{transaction_id[:20]}...`"
            })
        
        blocks.append({
            "type": "context",
            "elements": [
                {
                    "type": "mrkdwn",
                    "text": f"Processed on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
                }
            ]
        })
        
        text = f"✅ Payment received: {member_name} paid ${amount:.2f} via {payment_method}"
        return self.send_message(text, blocks)
    
    def send_status_update_notification(self, member_name: str, old_status: str, 
                                        new_status: str, updated_by: str = "Admin") -> Dict:
        """
        Send notification when member payment status is updated
        
        Args:
            member_name: Name of member
            old_status: Previous payment status
            new_status: New payment status
            updated_by: Who made the update
            
        Returns:
            Dict with send result
        """
        status_emoji = {
            "paid": "✅",
            "pending": "⚠️",
            "overdue": "🔴"
        }
        
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🔄 *Status Update*\n\n"
                            f"*Member:* {member_name}\n"
                            f"*Status Changed:* {status_emoji.get(old_status.lower(), '•')} {old_status} → "
                            f"{status_emoji.get(new_status.lower(), '•')} {new_status}\n"
                            f"*Updated by:* {updated_by}"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Updated on {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
                    }
                ]
            }
        ]
        
        text = f"Status Update: {member_name} - {old_status} → {new_status}"
        return self.send_message(text, blocks)
    
    def send_weekly_summary(self, stats: Dict) -> Dict:
        """
        Send weekly financial summary
        
        Args:
            stats: Dict with financial statistics
            
        Returns:
            Dict with send result
        """
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "📈 Weekly Financial Summary",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Total Members:*\n{stats.get('total_members', 0)}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Paid Members:*\n{stats.get('paid_members', 0)} ✅"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Total Collected:*\n${stats.get('total_collected', 0):.2f}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Outstanding:*\n${stats.get('outstanding_balance', 0):.2f}"
                    }
                ]
            },
            {
                "type": "divider"
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Collection Rate:* {stats.get('collection_rate', 0):.1f}%"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"Week ending {datetime.now().strftime('%B %d, %Y')}"
                    }
                ]
            }
        ]
        
        text = f"Weekly Summary: ${stats.get('total_collected', 0):.2f} collected, ${stats.get('outstanding_balance', 0):.2f} outstanding"
        return self.send_message(text, blocks)
    
    def send_expense_notification(self, expense_data: Dict) -> Dict:
        """
        Send notification when new expense is recorded
        
        Args:
            expense_data: Dict with expense information
            
        Returns:
            Dict with send result
        """
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "💸 New Expense Recorded",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "fields": [
                    {
                        "type": "mrkdwn",
                        "text": f"*Category:*\n{expense_data.get('category', 'N/A')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Amount:*\n${expense_data.get('amount', 0):.2f}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Event:*\n{expense_data.get('event_name', 'N/A')}"
                    },
                    {
                        "type": "mrkdwn",
                        "text": f"*Created by:*\n{expense_data.get('created_by', 'Unknown')}"
                    }
                ]
            }
        ]
        
        if expense_data.get('description'):
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Description:*\n{expense_data['description']}"
                }
            })
        
        text = f"New Expense: ${expense_data.get('amount', 0):.2f} for {expense_data.get('category', 'N/A')}"
        return self.send_message(text, blocks)
    
    def send_deadline_reminder(self, days_until_deadline: int, unpaid_count: int, 
                               total_outstanding: float) -> Dict:
        """
        Send reminder about upcoming payment deadline
        
        Args:
            days_until_deadline: Number of days until deadline
            unpaid_count: Number of members who haven't paid
            total_outstanding: Total amount outstanding
            
        Returns:
            Dict with send result
        """
        urgency = "🚨 URGENT" if days_until_deadline <= 3 else "⏰ REMINDER"
        
        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{urgency}: Payment Deadline Approaching",
                    "emoji": True
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*{days_until_deadline} days* until payment deadline\n\n"
                            f"*{unpaid_count} members* still need to pay\n"
                            f"*${total_outstanding:.2f}* outstanding"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": "Consider sending individual reminders to unpaid members"
                    }
                ]
            }
        ]
        
        text = f"{urgency}: {days_until_deadline} days until deadline - {unpaid_count} members unpaid"
        return self.send_message(text, blocks)
    
    def test_connection(self) -> Dict:
        """
        Test the Slack webhook connection
        
        Returns:
            Dict with test result
        """
        blocks = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "🧪 *Test Message*\n\nSlack integration is working correctly! ✅"
                }
            },
            {
                "type": "context",
                "elements": [
                    {
                        "type": "mrkdwn",
                        "text": f"TAMID Dues Tracker - {datetime.now().strftime('%B %d, %Y at %I:%M %p')}"
                    }
                ]
            }
        ]
        
        return self.send_message("Test message from TAMID Dues Tracker", blocks)