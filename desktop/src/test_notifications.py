import os
import json
import time
from datetime import datetime

# Path to notifications.json
NOTIFICATIONS_FILE = os.path.join(os.path.dirname(__file__), '../assets/notifications.json')

def add_test_notification():
    # Read existing notifications
    try:
        with open(NOTIFICATIONS_FILE, 'r', encoding='utf-8') as f:
            notifications = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        notifications = []
    
    # Create a test notification
    test_notification = {
        'type': 'email',
        'sender': 'Test Sender',
        'subject': f'Test Email at {datetime.now().strftime("%H:%M:%S")}',
        'timestamp': datetime.now().isoformat(),
        'id': f'test-{int(time.time())}',
        'read': False
    }
    
    # Add to beginning of list
    notifications.insert(0, test_notification)
    
    # Write back to file
    with open(NOTIFICATIONS_FILE, 'w', encoding='utf-8') as f:
        json.dump(notifications, f, indent=2)
    
    print(f"Added test notification: {test_notification['subject']}")

def main():
    print(f"Notifications file: {NOTIFICATIONS_FILE}")
    
    try:
        # Add a test notification every 5 seconds
        while True:
            add_test_notification()
            time.sleep(5)
    except KeyboardInterrupt:
        print("Test stopped")

if __name__ == "__main__":
    main() 