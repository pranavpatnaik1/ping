import time
import threading
import gmail_service as gmail_module

class EmailChecker:
    def __init__(self, check_interval=60):  # Check every minute by default
        self.check_interval = check_interval
        self.running = False
        self.thread = None
        self.service = None
    
    def start(self):
        # Initialize Gmail API
        creds = gmail_module.authenticate_gmail_api()
        self.service = gmail_module.get_gmail_service(creds)
        
        if not self.service:
            print("Failed to initialize Gmail service")
            return False
        
        # Start checking thread
        self.running = True
        self.thread = threading.Thread(target=self._check_loop)
        self.thread.daemon = True
        self.thread.start()
        return True
    
    def _check_loop(self):
        while self.running:
            try:
                # Check for new emails
                gmail_module.get_recent_emails(self.service)
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