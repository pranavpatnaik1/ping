import os
import base64
import pickle
import time
import threading
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

# Path to todo.txt
TODO_FILE = os.path.join(os.path.dirname(__file__), '../assets/todo.txt')

# Store the ID of the last processed email
last_email_id = None

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
        print(f"An error occurred: {error}")
        return None

# Update todo.txt with email notifications
def update_todo_with_emails(messages, service, user_id='me'):
    try:
        # Read existing content if file exists
        todo_content = ''
        if os.path.exists(TODO_FILE):
            with open(TODO_FILE, 'r', encoding='utf-8') as f:
                todo_content = f.read()
        
        # Process new messages
        new_emails_text = []
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
            
            # Add to list
            new_emails_text.append(f"📧 {sender}: {subject}")
        
        # Combine new emails with existing content
        if new_emails_text:
            # Split existing content by lines
            existing_lines = todo_content.strip().split('\n') if todo_content.strip() else []
            
            # Filter out existing email notifications to avoid duplicates
            filtered_lines = [line for line in existing_lines if not line.startswith('📧 ')]
            
            # Combine new emails with filtered content
            updated_content = '\n'.join(new_emails_text)
            if filtered_lines:
                updated_content += '\n\n' + '\n'.join(filtered_lines)
            
            # Write back to todo.txt
            with open(TODO_FILE, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            
            print(f"Added {len(new_emails_text)} new emails to todo.txt")
            return True
        return False
            
    except Exception as e:
        print(f"Error updating todo with emails: {e}")
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
            print(f"No messages found in inbox ({datetime.now().strftime('%H:%M:%S')})")
            return False
        
        # If this is the first run, just store the most recent email ID
        if last_email_id is None:
            last_email_id = messages[0]['id']
            print(f"First run - storing latest email ID: {last_email_id}")
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
            print(f"No new messages since last check ({datetime.now().strftime('%H:%M:%S')})")
            return False
        else:
            print(f"Found {len(new_messages)} new messages at {datetime.now().strftime('%H:%M:%S')}")
            
            # Update todo.txt with these messages
            updated = update_todo_with_emails(new_messages, service, user_id)
            
            # Print details for debugging
            for message in new_messages[:3]:  # Limit to 3 for debugging
                msg = service.users().messages().get(userId=user_id, id=message['id']).execute()
                headers = msg['payload']['headers']
                
                # Extract subject
                subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No subject)')
                print(f"Subject: {subject}")
            
            return updated
        
    except HttpError as error:
        print(f"An error occurred: {error}")
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
                print("Failed to initialize Gmail service")
                return False
            
            # Start checking thread
            self.running = True
            self.thread = threading.Thread(target=self._check_loop)
            self.thread.daemon = True
            self.thread.start()
            
            # Do an initial check immediately
            threading.Thread(target=lambda: check_recent_emails(self.service)).start()
            
            return True
        except Exception as e:
            print(f"Error starting email checker: {e}")
            return False
    
    def _check_loop(self):
        while self.running:
            try:
                # Check for new emails
                check_recent_emails(self.service)
            except Exception as e:
                print(f"Error checking emails: {e}")
            
            # Wait for next check
            time.sleep(self.check_interval)
    
    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=1)

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
            print("Email checker started successfully")
            
            # Keep the script running
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("Stopping email checker...")
                stop_email_checker()
        else:
            print("Failed to start email checker")
    except Exception as e:
        print(f"Error in main: {e}")

if __name__ == '__main__':
    main()
