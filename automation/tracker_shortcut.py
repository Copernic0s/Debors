import tkinter as tk
import keyboard
import json
import os
import uuid
import urllib.request
import urllib.parse
from datetime import datetime

GEMINI_API_KEY = "AIzaSyDjd6_cyrbVUX33DDmT6tZIYB3Mb2BK9X8"

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

def call_gemini(prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
    
    system_instruction = """
    Eres un asistente de cobros. Tu tarea es extraer la siguiente información del texto del usuario:
    - company: El nombre de la empresa a la que se refiere.
    - task: La tarea, acción o nota realizada (resumida de forma clara).
    - status: El estado. Debe ser estrictamente uno de estos tres: "Follow-up", "In Progress", "Completed". Deduce el estado por el contexto (ej. pendiente, llamar luego, sin respuesta = Follow-up. pagado, resuelto = Completed. trabajando en ello = In Progress).
    
    Devuelve ÚNICAMENTE un objeto JSON válido, sin formato markdown ni otros textos. Ejemplo:
    {"company": "TechSolutions", "task": "Llamada realizada, dicen que pagan el viernes", "status": "Follow-up"}
    """
    
    data = {
        "contents": [{"parts": [{"text": system_instruction + "\n\nTexto del usuario: " + prompt}]}]
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})
    
    try:
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode('utf-8'))
        text_response = result['candidates'][0]['content']['parts'][0]['text']
        # Limpiar posibles bloques markdown de JSON
        text_response = text_response.replace('```json', '').replace('```', '').strip()
        return json.loads(text_response)
    except Exception as e:
        print("Error llamando a Gemini:", e)
        return None

def log_entry(input_text):
    print("Procesando con Inteligencia Artificial...")
    ai_result = call_gemini(input_text)
    
    if ai_result and isinstance(ai_result, dict):
        company = ai_result.get("company", "Unknown")
        task = ai_result.get("task", input_text)
        status = ai_result.get("status", "Follow-up")
    else:
        # Fallback si falla la IA
        parts = [p.strip() for p in input_text.split('-')]
        company = parts[0] if len(parts) > 0 else "Unknown"
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
        text="Portapapeles + IA Activada: Escribe tu nota natural", 
        bg='#1e293b', 
        fg='#94a3b8',
        font=('Arial', 10)
    ).pack(pady=(15, 5))
    
    entry = tk.Entry(root, width=50, font=('Arial', 11), bg='#0f172a', fg='#f8fafc', insertbackground='white')
    entry.pack(pady=5, ipady=4)
    
    # Magia del Portapapeles
    try:
        clip = root.clipboard_get().strip()
        if len(clip) > 0 and len(clip) < 50 and '\n' not in clip:
            entry.insert(0, clip + " - ")
    except:
        pass
        
    entry.focus_set()
    entry.icursor(tk.END) # Mover el cursor al final
    
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
