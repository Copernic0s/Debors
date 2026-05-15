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
    root.overrideredirect(True)
    root.configure(bg='#0f172a')
    
    # Efecto Glassmorphism (Transparencia)
    root.attributes('-alpha', 0.92)
    
    window_width = 750
    window_height = 70
    
    root.update_idletasks()
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    x = (screen_width // 2) - (window_width // 2)
    y = int(screen_height * 0.35) # Más arriba, estilo Spotlight/Raycast
    root.geometry(f"{window_width}x{window_height}+{x}+{y}")
    root.attributes("-topmost", True)
    
    # ¡Forzar foco de Windows para no tener que hacer clic!
    root.lift()
    root.focus_force()
    
    # Borde sutil
    main_frame = tk.Frame(root, bg='#334155', bd=1)
    main_frame.pack(fill=tk.BOTH, expand=True)
    
    input_frame = tk.Frame(main_frame, bg='#1e293b')
    input_frame.pack(fill=tk.BOTH, expand=True, padx=1, pady=1)
    
    tk.Label(
        input_frame,
        text="✨",
        bg='#1e293b',
        fg='#ffffff',
        font=('Segoe UI', 16)
    ).pack(side=tk.LEFT, padx=(15, 5))
    
    entry = tk.Entry(
        input_frame, 
        font=('Segoe UI', 16), 
        bg='#1e293b', 
        fg='#f8fafc', 
        insertbackground='#ffffff', 
        relief=tk.FLAT,
        bd=0
    )
    entry.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=5, pady=5)
    
    try:
        clip = root.clipboard_get().strip()
        if len(clip) > 0 and len(clip) < 50 and '\n' not in clip:
            entry.insert(0, clip + " - ")
    except:
        pass
        
    entry.focus_set()
    entry.icursor(tk.END)
    
    def on_submit(event=None):
        text = entry.get()
        if text.strip():
            entry.delete(0, tk.END)
            entry.insert(0, "Guardando con IA...")
            entry.config(state=tk.DISABLED)
            root.update()
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
