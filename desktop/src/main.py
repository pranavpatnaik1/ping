# # import email_scheduler
# # import gmail_service

import email_service
import time
import threading
import sys
import os

def initialize_services():
    try:
        # Start email checker in a separate thread
        email_thread = threading.Thread(target=email_service.start_email_checker)
        email_thread.daemon = True
        email_thread.start()
        print("Email checker started")
        
        # Create todo.txt if it doesn't exist
        todo_file = os.path.join(os.path.dirname(__file__), '../assets/todo.txt')
        if not os.path.exists(os.path.dirname(todo_file)):
            os.makedirs(os.path.dirname(todo_file))
        if not os.path.exists(todo_file):
            with open(todo_file, 'w', encoding='utf-8') as f:
                f.write("Welcome to Ping! Your emails will appear here.")
        
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