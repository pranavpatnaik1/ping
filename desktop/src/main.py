import email_scheduler
import gmail_service

def initialize_services():
    try:
        # Start email checker
        email_scheduler.start_email_checker()
        print("Email checker started")
    except Exception as e:
        print(f"Error starting email checker: {e}")

def cleanup():
    try:
        email_scheduler.stop_email_checker()
    except:
        pass 