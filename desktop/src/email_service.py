import os
import base64
import pickle
import time
import threading
import json
from datetime import datetime, timedelta
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Get credentials from environment variables
CLIENT_ID = os.getenv('GMAIL_CLIENT_ID')
CLIENT_SECRET = os.getenv('GMAIL_CLIENT_SECRET')
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Path to notifications.json
NOTIFICATIONS_FILE = os.path.join(os.path.dirname(__file__), '../assets/notifications.json')

# Store the ID of the last processed email
last_email_id = None

# Improved logging function
def log(message):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

# Authentication and building the Gmail service
def authenticate_gmail_api():
    creds = None
    # The file token.pickle stores the user's access and refresh tokens.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            from google_auth_oauthlib.flow import InstalledAppFlow
            
            # Create client config dictionary from environment variables
            client_config = {
                "installed": {
                    "client_id": CLIENT_ID,
                    "project_id": "ping-desktop-project",
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                    "client_secret": CLIENT_SECRET,
                    "redirect_uris": ["http://localhost"]
                }
            }
            
            # Use from_client_config instead of from_client_secrets_file
            flow = InstalledAppFlow.from_client_config(
                client_config, SCOPES)
            creds = flow.run_local_server(port=0)
        
        # Save the credentials for the next run
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return creds

# Get Gmail service
def get_gmail_service(creds):
    try:
        service = build('gmail', 'v1', credentials=creds)
        return service
    except Exception as error:
        log(f"An error occurred: {error}")
        return None

# Update notifications.json with email notifications
def update_notifications_with_emails(messages, service, user_id='me'):
    try:
        # Read existing notifications if file exists
        notifications = []
        if os.path.exists(NOTIFICATIONS_FILE):
            try:
                with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
                    notifications = json.load(f)
            except json.JSONDecodeError:
                # If the file is corrupted, start fresh
                notifications = []
        
        # Process new messages
        new_emails = []
        for message in messages[:5]:  # Limit to 5 most recent
            msg = service.users().messages().get(userId=user_id, id=message['id']).execute()
            headers = msg['payload']['headers']
            
            # Extract subject and sender
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No subject)')
            sender = next((header['value'] for header in headers if header['name'] == 'From'), 'Unknown sender')
            
            # Clean up sender name (extract just the name if possible)
            if '<' in sender:
                sender_name = sender.split('<')[0].strip()
                if sender_name:
                    sender = sender_name
            
            # Create email notification object
            email_notification = {
                'type': 'email',
                'sender': sender,
                'subject': subject,
                'timestamp': datetime.now().isoformat(),
                'id': message['id'],
                'read': False
            }
            
            new_emails.append(email_notification)
        
        # Add new emails to the notifications list
        if new_emails:
            # Add new emails at the beginning
            updated_notifications = new_emails + notifications
            
            # Write back to JSON file
            with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
                json.dump(updated_notifications, f, indent=2)
            
            log(f"Added {len(new_emails)} new emails to notifications.json")
            return True
        return False
            
    except Exception as e:
        log(f"Error updating notifications with emails: {e}")
        return False

# Check for recent emails
def check_recent_emails(service, user_id='me'):
    global last_email_id
    
    try:
        # Query for recent emails in the inbox
        query = "in:inbox"
        
        # List the emails in the inbox (most recent first)
        results = service.users().messages().list(userId=user_id, q=query, maxResults=10).execute()
        messages = results.get('messages', [])

        if not messages:
            log(f"No messages found in inbox")
            return False
        
        # If this is the first run, just store the most recent email ID
        if last_email_id is None:
            last_email_id = messages[0]['id']
            log(f"First run - storing latest email ID: {last_email_id}")
            return False
        
        # Find new messages (those with IDs we haven't seen before)
        new_messages = []
        for message in messages:
            if message['id'] == last_email_id:
                break
            new_messages.append(message)
        
        # Update the last email ID
        if messages and messages[0]['id'] != last_email_id:
            last_email_id = messages[0]['id']
        
        if not new_messages:
            log(f"No new messages since last check")
            return False
        else:
            log(f"Found {len(new_messages)} new messages")
            
            # Update notifications.json with these messages
            updated = update_notifications_with_emails(new_messages, service, user_id)
            
            # Print details for debugging
            for message in new_messages[:3]:  # Limit to 3 for debugging
                msg = service.users().messages().get(userId=user_id, id=message['id']).execute()
                headers = msg['payload']['headers']
                
                # Extract subject
                subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No subject)')
                log(f"Subject: {subject}")
            
            return updated
        
    except HttpError as error:
        log(f"An error occurred: {error}")
        return False

# Email checker class for background monitoring
class EmailChecker:
    def __init__(self, check_interval=30):  # Check every 30 seconds by default
        self.check_interval = check_interval
        self.running = False
        self.thread = None
        self.service = None
    
    def start(self):
        # Initialize Gmail API
        try:
            creds = authenticate_gmail_api()
            self.service = get_gmail_service(creds)
            
            if not self.service:
                log("Failed to initialize Gmail service")
                return False
            
            # Start checking thread
            self.running = True
            self.thread = threading.Thread(target=self._check_loop)
            self.thread.daemon = True
            self.thread.start()
            
            # Do an initial check immediately (directly, not in a separate thread)
            check_recent_emails(self.service)
            
            return True
        except Exception as e:
            log(f"Error starting email checker: {e}")
            return False
    
    def _check_loop(self):
        while self.running:
            start_time = time.time()
            
            try:
                # Check for new emails
                check_recent_emails(self.service)
            except HttpError as e:
                log(f"API error: {e}. Reconnecting...")
                try:
                    creds = authenticate_gmail_api()
                    self.service = get_gmail_service(creds)
                except Exception as reconnect_error:
                    log(f"Failed to reconnect: {reconnect_error}")
            except Exception as e:
                log(f"Error checking emails: {e}")
            
            # Calculate remaining sleep time to maintain consistent interval
            elapsed = time.time() - start_time
            sleep_time = max(0, self.check_interval - elapsed)
            time.sleep(sleep_time)
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)
            log("Email checker stopped gracefully")

# Create a singleton instance
email_checker = EmailChecker()

def start_email_checker():
    return email_checker.start()

def stop_email_checker():
    email_checker.stop()

# Main function to authenticate and start monitoring
def main():
    try:
        # Start the email checker
        if start_email_checker():
            log("Email checker started successfully")
            
            # Keep the script running
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                log("Stopping email checker...")
                stop_email_checker()
        else:
            log("Failed to start email checker")
    except Exception as e:
        log(f"Error in main: {e}")

# Add this function to email_service.py to force a check
def force_check():
    """Force a check for new emails and update notifications.json"""
    global last_email_id
    
    try:
        # Reset the last email ID to force a full check
        last_email_id = None
        
        # Authenticate and get service
        creds = authenticate_gmail_api()
        service = get_gmail_service(creds)
        
        if not service:
            log("Failed to initialize Gmail service")
            return False
        
        # Check for emails
        result = check_recent_emails(service)
        return result
    except Exception as e:
        log(f"Error in force_check: {e}")
        return False

if __name__ == '__main__':
    main()
