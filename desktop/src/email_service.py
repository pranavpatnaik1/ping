import os
import base64
import pickle
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Path to your OAuth 2.0 credentials file (JSON)
CLIENT_SECRET_FILE = 'C:/Users/prana/Documents/GitHub/ping/desktop/src/client_secret_525422293143-f9a9tj45vf1bdulod7k2jq7dtho7hq3c.apps.googleusercontent.com.json'
SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

# Authentication and building the Gmail service
def authenticate_gmail_api():
    creds = None
    # The file token.pickle stores the user's access and refresh tokens.
    # It is created automatically when the authorization flow completes for the first time.
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    # If there are no (valid) credentials available, let the user log in.
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            from google_auth_oauthlib.flow import InstalledAppFlow
            flow = InstalledAppFlow.from_client_secrets_file(
                CLIENT_SECRET_FILE, SCOPES)
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

# Add this function to update todo.txt with email notifications
def update_todo_with_emails(messages, service, user_id='me'):
    try:
        todo_path = os.path.join(os.path.dirname(__file__), '../assets/todo.txt')
        
        # Read existing content if file exists
        todo_content = ''
        if os.path.exists(todo_path):
            with open(todo_path, 'r', encoding='utf-8') as f:
                todo_content = f.read()
        
        # Process new messages
        new_emails_text = []
        for message in messages[:10]:  # Limit to 10 most recent
            msg = service.users().messages().get(userId=user_id, id=message['id']).execute()
            headers = msg['payload']['headers']
            
            # Extract subject and sender
            subject = next((header['value'] for header in headers if header['name'] == 'Subject'), '(No subject)')
            sender = next((header['value'] for header in headers if header['name'] == 'From'), 'Unknown sender')
            
            # Add to list
            new_emails_text.append(f"📧 {sender}: {subject}")
        
        # Combine new emails with existing content
        if new_emails_text:
            updated_content = '\n'.join(new_emails_text)
            if todo_content:
                updated_content += '\n\n' + todo_content
            
            # Write back to todo.txt
            with open(todo_path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            
            print(f"Added {len(new_emails_text)} new emails to todo.txt")
            
    except Exception as e:
        print(f"Error updating todo with emails: {e}")

# Modify the get_recent_emails function to update todo.txt
def get_recent_emails(service, user_id='me', max_results=10):
    try:
        # List the emails in the inbox
        results = service.users().messages().list(userId=user_id, labelIds=['INBOX'], q="is:unread").execute()
        messages = results.get('messages', [])

        if not messages:
            print("No new messages.")
        else:
            print(f"Found {len(messages)} new messages.")
            # Update todo.txt with these messages
            update_todo_with_emails(messages, service, user_id)
            
            # Print details for debugging
            for message in messages[:max_results]:
                msg = service.users().messages().get(userId=user_id, id=message['id']).execute()
                payload = msg['payload']
                headers = payload['headers']
                
                # Extract subject
                subject = next(header['value'] for header in headers if header['name'] == 'Subject')
                print(f"Subject: {subject}")
                
    except HttpError as error:
        print(f"An error occurred: {error}")

# Main function to authenticate and fetch emails
def main():
    creds = authenticate_gmail_api()
    service = get_gmail_service(creds)
    
    if service:
        get_recent_emails(service)

if __name__ == '__main__':
    main()
