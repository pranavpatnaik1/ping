import tkinter as tk
from tkinter import Label
from PIL import Image, ImageTk
import os
from win32api import GetSystemMetrics
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class TodoWatcher(FileSystemEventHandler):
    def __init__(self, buddy):
        self.buddy = buddy
        
    def on_modified(self, event):
        if event.src_path.endswith('todo.txt'):
            # Schedule update in main thread
            self.buddy.root.after(100, self.buddy.update_todo)

class DesktopBuddy:
    def __init__(self, root):
        self.root = root
        self.root.overrideredirect(True)
        self.root.attributes('-topmost', True)
        
        # Make the window completely transparent
        self.root.attributes('-alpha', 1.0)
        self.transparent_color = '#000001'  # Using a very specific color that won't be in the image
        self.root.configure(bg=self.transparent_color)
        self.root.attributes('-transparentcolor', self.transparent_color)
        
        # Load and resize all images
        idle_image = Image.open("../assets/ping-idle.png")
        improve_image = Image.open("../assets/ping-idle-improve.png")
        limp_image = Image.open("../assets/ping-raise.png")  # Add this line
        fall_image = Image.open("../assets/ping-falling.png")  # Add this line
        
        idle_image = idle_image.resize((50, 50), Image.Resampling.LANCZOS)
        improve_image = improve_image.resize((50, 50), Image.Resampling.LANCZOS)
        limp_image = limp_image.resize((50, 50), Image.Resampling.LANCZOS)
        fall_image = fall_image.resize((50, 50), Image.Resampling.LANCZOS)
        
        if idle_image.mode != 'RGBA':
            idle_image = idle_image.convert('RGBA')
        if improve_image.mode != 'RGBA':
            improve_image = improve_image.convert('RGBA')
        if limp_image.mode != 'RGBA':  # Add this block
            limp_image = limp_image.convert('RGBA')

        # Create all image variants
        self.image_idle_right = ImageTk.PhotoImage(idle_image)
        self.image_idle_left = ImageTk.PhotoImage(idle_image.transpose(Image.FLIP_LEFT_RIGHT))
        self.image_improve_right = ImageTk.PhotoImage(improve_image)
        self.image_improve_left = ImageTk.PhotoImage(improve_image.transpose(Image.FLIP_LEFT_RIGHT))
        self.image_limp_right = ImageTk.PhotoImage(limp_image)  # Add these lines
        self.image_limp_left = ImageTk.PhotoImage(limp_image.transpose(Image.FLIP_LEFT_RIGHT))
        self.image_fall_right = ImageTk.PhotoImage(fall_image)
        self.image_fall_left = ImageTk.PhotoImage(fall_image.transpose(Image.FLIP_LEFT_RIGHT))
        
        self.photo = self.image_idle_left  # Default state
        
        # Create label without border or padding
        self.label = Label(root, 
                          image=self.photo, 
                          bd=0, 
                          bg=self.transparent_color, 
                          highlightthickness=0,
                          padx=0,  # Remove horizontal padding
                          pady=0)  # Remove vertical padding
        self.label.pack()
        
        # Create separate window for speech bubble
        self.bubble_window = tk.Toplevel(root)
        self.bubble_window.overrideredirect(True)
        self.bubble_window.attributes('-topmost', True)
        self.bubble_window.withdraw()
        
        # Create speech bubble with rounded corners and better styling
        self.bubble_container = tk.Frame(self.bubble_window, bg='white')
        self.bubble_container.pack(expand=True, fill='both')
        
        self.bubble = tk.Label(self.bubble_container, text="", 
                             bg="white", fg="black",
                             wraplength=200, padx=10, pady=5,
                             font=('Arial', 9),
                             relief="solid", bd=1)
        self.bubble.pack()
        
        self.fade_id = None  # For tracking fade animation
        self.expand_id = None
        self.alpha = 0.0     # Current opacity
        self.expand_progress = 0.0
        self.final_height = 0
        self.dragging = False  # Add this new variable
        self.fall_id = None  # Add this for fall animation
        self.fall_speed = 0  # Initial fall speed
        self.fall_acceleration = 0.5  # Acceleration rate
        self.target_y = 0  # Will store the target y position
        
        # Bind events
        self.label.bind('<Button-1>', self.start_move)
        self.label.bind('<B1-Motion>', self.on_drag)
        self.label.bind('<ButtonRelease-1>', self.stop_move)  # Add this new binding
        self.label.bind('<Enter>', self.show_todo)
        self.label.bind('<Leave>', self.hide_todo)
        
        # Set initial position in bottom right corner above taskbar
        screen_height = GetSystemMetrics(1)  # Gets actual work area height
        initial_x = self.root.winfo_screenwidth() - 100  # 100 pixels from right edge
        initial_y = screen_height - 90  
        self.root.geometry(f"+{initial_x}+{initial_y}")
        self.update_cat_direction()

        # Add todo watcher
        self.observer = Observer()
        event_handler = TodoWatcher(self)
        self.observer.schedule(event_handler, path="../assets", recursive=False)
        self.observer.start()
        
        # Store current todo text
        self.current_todo = ""
        self.update_todo()  # Initial load

    def start_move(self, event):
        self.dragging = True
        self.x = event.x
        self.y = event.y
        # Change to limp image when starting drag
        is_on_left = self.root.winfo_x() < (self.root.winfo_screenwidth() / 2)
        self.label.configure(image=self.image_limp_left if is_on_left else self.image_limp_right)
        self.hide_todo(event)

    def stop_move(self, event):
        self.dragging = False
        # Change to fall image when starting to fall
        is_on_left = self.root.winfo_x() < (self.root.winfo_screenwidth() / 2)
        self.label.configure(image=self.image_fall_right if is_on_left else self.image_fall_left)
        # Start falling animation
        self.fall_speed = 0
        screen_height = GetSystemMetrics(1)
        self.target_y = screen_height - 90  # Same as initial_y
        self.fall_animation()

    def on_drag(self, event):
        deltax = event.x - self.x
        deltay = event.y - self.y
        x = self.root.winfo_x() + deltax
        y = self.root.winfo_y() + deltay
        self.root.geometry(f"+{x}+{y}")
        # Update limp direction while dragging
        is_on_left = x < (self.root.winfo_screenwidth() / 2)
        self.label.configure(image=self.image_limp_left if is_on_left else self.image_limp_right)
        if self.bubble_window.winfo_viewable():
            self.position_bubble()

    def position_bubble(self):
        # Get screen dimensions
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        
        # Determine which side of the screen the cat is on
        cat_x = self.root.winfo_x()
        is_on_left = cat_x < (screen_width / 2)
        
        # Calculate bubble position based on cat's position
        if is_on_left:
            # Cat faces right, bubble appears on top right
            x = cat_x + self.root.winfo_width()
        else:
            # Cat faces left, bubble appears on top left
            x = cat_x - self.bubble_window.winfo_width()
        
        # Position vertically above the cat
        y = self.root.winfo_y() - self.bubble_window.winfo_height() - 5
        
        # Adjust if going off screen edges
        if x + self.bubble_window.winfo_width() > screen_width:
            x = screen_width - self.bubble_window.winfo_width()
        if x < 0:
            x = 0
        
        # If no space above, position below
        if y < 0:
            y = self.root.winfo_y() + self.root.winfo_height() + 5
        
        self.bubble_window.geometry(f"+{x}+{y}")

    def fade_in(self):
        if self.alpha < 1.0:
            self.alpha += 0.1
            self.bubble_window.attributes('-alpha', self.alpha)
            self.fade_id = self.root.after(20, self.fade_in)

    def expand_animation(self):
        if self.expand_progress < 1.0:
            self.expand_progress += 0.15
            progress = min(1.0, self.expand_progress)
            
            # Calculate current height
            current_height = int(self.final_height * progress)
            
            # Update geometry maintaining the same top position
            current_y = self.bubble_window.winfo_y()
            self.bubble_container.configure(height=current_height)
            self.bubble_window.geometry(f"{self.bubble_window.winfo_width()}x{current_height}")
            
            # Keep text hidden until animation reaches 50%
            if progress < 0.5:
                self.bubble.pack_forget()
            else:
                self.bubble.pack(expand=True, fill='both')
            
            self.expand_id = self.root.after(20, self.expand_animation)
        else:
            self.expand_id = None

    def show_todo(self, event):
        if not self.dragging:
            # Update image to improve version
            is_on_left = self.root.winfo_x() < (self.root.winfo_screenwidth() / 2)
            self.label.configure(image=self.image_improve_left if is_on_left else self.image_improve_right)
            try:
                with open("../assets/todo.txt", "r") as file:
                    todo_text = file.read().strip()
                self.bubble.config(text=todo_text)
                
                # Reset animation states
                self.bubble_window.attributes('-alpha', 0.0)
                self.alpha = 0.0
                self.expand_progress = 0.0
                
                # Position and show window before calculating sizes
                self.bubble_window.deiconify()
                self.bubble.update()
                
                # Store final dimensions
                self.final_height = self.bubble.winfo_reqheight()
                bubble_width = self.bubble.winfo_reqwidth()
                
                # Set initial size (1px height but full width)
                self.bubble_window.geometry(f"{bubble_width}x1")
                self.bubble_container.configure(height=1)
                
                # Position the bubble
                self.position_bubble()
                
                # Start both animations
                self.fade_in()
                self.expand_animation()
                
            except FileNotFoundError:
                self.bubble.config(text="No todo.txt found!")
                self.bubble_window.deiconify()
                self.position_bubble()

    def hide_todo(self, event):
        # Only change to idle image if we're not falling and at the target y position
        if not self.fall_id and self.root.winfo_y() >= self.target_y:
            is_on_left = self.root.winfo_x() < (self.root.winfo_screenwidth() / 2)
            self.label.configure(image=self.image_idle_left if is_on_left else self.image_idle_right)
        
        if self.fade_id:
            self.root.after_cancel(self.fade_id)
        if self.expand_id:
            self.root.after_cancel(self.expand_id)
        self.bubble_window.withdraw()

    def update_cat_direction(self):
        screen_width = self.root.winfo_screenwidth()
        cat_x = self.root.winfo_x()
        is_on_left = cat_x < (screen_width / 2)
        
        # Check if we're currently showing improve or idle image
        is_improve = self.bubble_window.winfo_viewable()
        if is_improve:
            self.label.configure(image=self.image_improve_left if is_on_left else self.image_improve_right)
        else:
            self.label.configure(image=self.image_idle_left if is_on_left else self.image_idle_right)

    def update_todo(self):
        try:
            with open("../assets/todo.txt", "r") as file:
                new_todo = file.read().strip()
                if new_todo != self.current_todo:
                    self.current_todo = new_todo
                    if self.bubble_window.winfo_viewable():
                        self.bubble.config(text=self.current_todo)
        except FileNotFoundError:
            self.current_todo = "No todo.txt found!"

    def fall_animation(self):
        if self.fall_id:
            self.root.after_cancel(self.fall_id)
        
        current_y = self.root.winfo_y()
        
        if current_y < self.target_y:
            # Apply gravity
            self.fall_speed += self.fall_acceleration
            new_y = current_y + self.fall_speed
            
            # Check if we've hit or passed the target
            if new_y >= self.target_y:
                # Set final position
                new_y = self.target_y
                self.root.geometry(f"+{self.root.winfo_x()}+{int(new_y)}")
                
                # Only NOW change back to idle image
                is_on_left = self.root.winfo_x() < (self.root.winfo_screenwidth() / 2)
                self.label.configure(image=self.image_idle_left if is_on_left else self.image_idle_right)
                self.fall_id = None
            else:
                # Still falling, update position and continue animation
                self.root.geometry(f"+{self.root.winfo_x()}+{int(new_y)}")
                self.fall_id = self.root.after(16, self.fall_animation)  # ~60fps

    def __del__(self):
        self.observer.stop()
        self.observer.join()

if __name__ == "__main__":
    root = tk.Tk()
    app = DesktopBuddy(root)
    root.mainloop()