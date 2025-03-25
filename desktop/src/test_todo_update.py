import os
import time
from datetime import datetime

# Path to todo.txt
TODO_FILE = os.path.join(os.path.dirname(__file__), '../assets/todo.txt')

def update_todo_with_timestamp():
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    content = f"📧 Test Email: This is a test email at {timestamp}\n\nstudy"
    
    with open(TODO_FILE, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"Updated todo.txt at {timestamp}")

def main():
    print("Starting todo.txt update test...")
    print(f"Will update {TODO_FILE} every 5 seconds")
    
    try:
        while True:
            update_todo_with_timestamp()
            time.sleep(5)  # Update every 5 seconds
    except KeyboardInterrupt:
        print("Test stopped by user")

if __name__ == "__main__":
    main() 