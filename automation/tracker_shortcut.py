import tkinter as tk
import keyboard
import json
import os
import uuid
from datetime import datetime

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(BASE_DIR, 'local_tracker.json')

def load_data():
    if not os.path.exists(JSON_PATH):
        return []
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []

def save_data(data):
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def log_entry(input_text):
    # Format expected: Company - Task - Status
    parts = [p.strip() for p in input_text.split('-')]
    company = parts[0] if len(parts) > 0 else "Unknown"
    
    # If there's no dash, the whole thing is the task and company is unknown
    if len(parts) == 1:
        task = parts[0]
        company = "Unknown"
    else:
        task = parts[1]
        
    status = parts[2] if len(parts) > 2 else "Follow-up"
    
    # The date is captured dynamically when the entry is logged
    now = datetime.now()
    date_str = now.strftime('%Y-%m-%d')
    
    entry = {
        "id": f"TRK-local-{str(uuid.uuid4())[:8]}",
        "date": date_str,
        "company": company,
        "agent": "Hector", # Default agent
        "task": task,
        "status": status,
        "notes": "",
        "isLocal": True
    }
    
    data = load_data()
    data.append(entry)
    save_data(data)

def show_input_dialog():
    root = tk.Tk()
    root.title("Tracker Rápido")
    root.geometry("450x120")
    root.attributes("-topmost", True)
    root.configure(bg='#1e293b') # Dark mode feel
    
    # Center the window
    root.update_idletasks()
    width = root.winfo_width()
    frm_width = root.winfo_rootx() - root.winfo_x()
    win_width = width + 2 * frm_width
    height = root.winfo_height()
    titlebar_height = root.winfo_rooty() - root.winfo_y()
    win_height = height + titlebar_height + frm_width
    x = root.winfo_screenwidth() // 2 - win_width // 2
    y = root.winfo_screenheight() // 2 - win_height // 2
    root.geometry(f'{width}x{height}+{x}+{y}')
    
    tk.Label(
        root, 
        text="Formato: Empresa - Tarea a registrar - Estado (opcional)", 
        bg='#1e293b', 
        fg='#94a3b8',
        font=('Arial', 10)
    ).pack(pady=(15, 5))
    
    entry = tk.Entry(root, width=50, font=('Arial', 11), bg='#0f172a', fg='#f8fafc', insertbackground='white')
    entry.pack(pady=5, ipady=4)
    entry.focus_set()
    
    def on_submit(event=None):
        text = entry.get()
        if text.strip():
            log_entry(text)
        root.destroy()
        
    def on_escape(event=None):
        root.destroy()
        
    entry.bind('<Return>', on_submit)
    root.bind('<Escape>', on_escape)
    
    root.mainloop()

def on_hotkey():
    show_input_dialog()

def main():
    print("✅ Tracker Rápido corriendo en segundo plano.")
    print("👉 Presiona 'Ctrl + Alt + T' desde cualquier app para abrir la ventana.")
    print("👉 Presiona 'Ctrl + C' en esta consola para salir.")
    
    if not os.path.exists(JSON_PATH):
        save_data([])
        
    keyboard.add_hotkey('ctrl+alt+t', on_hotkey)
    keyboard.wait()

if __name__ == '__main__':
    main()
