# # import email_scheduler
# # import gmail_service

import email_service
import time
import threading
import sys
import os
import json
from datetime import datetime

def initialize_services():
    try:
        # Start email checker in a separate thread
        email_thread = threading.Thread(target=email_service.start_email_checker)
        email_thread.daemon = True
        email_thread.start()
        print("Email checker started")
        
        # Create notifications.json if it doesn't exist
        notifications_file = os.path.join(os.path.dirname(__file__), '../assets/notifications.json')
        if not os.path.exists(os.path.dirname(notifications_file)):
            os.makedirs(os.path.dirname(notifications_file))
        if not os.path.exists(notifications_file):
            with open(notifications_file, 'w', encoding='utf-8') as f:
                json.dump([
                    {
                        "type": "system",
                        "message": "Welcome to Ping! Your notifications will appear here.",
                        "timestamp": datetime.now().isoformat(),
                        "read": False
                    },
                    {
                        "type": "task",
                        "message": "study",
                        "timestamp": datetime.now().isoformat(),
                        "read": False
                    }
                ], f, indent=2)
        
        return True
    except Exception as e:
        print(f"Error starting email checker: {e}")
        return False

def cleanup():
    try:
        email_service.stop_email_checker()
        print("Email checker stopped")
    except Exception as e:
        print(f"Error stopping email checker: {e}")

def main():
    # Initialize services
    if initialize_services():
        try:
            # Keep the script running until interrupted
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("Shutting down...")
        finally:
            cleanup()
    else:
        print("Failed to initialize services")
        sys.exit(1)

if __name__ == "__main__":
    main() 