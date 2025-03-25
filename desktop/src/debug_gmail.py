import os
import pickle
import base64
from datetime import datetime
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

def log(message):
    print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {message}")

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

def get_gmail_service(creds):
    try:
        service = build('gmail', 'v1', credentials=creds)
        return service
    except Exception as error:
        log(f"An error occurred: {error}")
        return None

def list_recent_emails(service, user_id='me'):
    try:
        # Query for recent emails in the inbox
        query = "in:inbox"
        
        # List the emails in the inbox (most recent first)
        results = service.users().messages().list(userId=user_id, q=query, maxResults=10).execute()
        messages = results.get('messages', [])

        if not messages:
            log(f"No messages found in inbox")
            return
        
        log(f"Found {len(messages)} messages in inbox")
        
        # Print details for each message
        for i, message in enumerate(messages):
            msg = service.users().messages().get(userId=user_id, id=message['id']).execute()
            headers = msg['payload']['headers']
            
            # Extract subject and sender
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No subject)')
            sender = next((header['value'] for header in headers if header['name'] == 'From'), 'Unknown sender')
            
            # Get internal date (timestamp)
            internal_date = int(msg['internalDate']) / 1000  # Convert to seconds
            date_str = datetime.fromtimestamp(internal_date).strftime('%Y-%m-%d %H:%M:%S')
            
            log(f"Email {i+1}: ID={message['id']}")
            log(f"  From: {sender}")
            log(f"  Subject: {subject}")
            log(f"  Date: {date_str}")
            log(f"  Snippet: {msg['snippet'][:50]}...")
            log("---")
            
    except HttpError as error:
        log(f"An error occurred: {error}")

def main():
    try:
        log("Starting Gmail API debug...")
        
        # Authenticate and get service
        creds = authenticate_gmail_api()
        service = get_gmail_service(creds)
        
        if not service:
            log("Failed to initialize Gmail service")
            return
        
        # List recent emails
        list_recent_emails(service)
        
        log("Debug complete")
        
    except Exception as e:
        log(f"Error in main: {e}")

if __name__ == '__main__':
    main() 