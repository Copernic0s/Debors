import tkinter as tk
import keyboard
import json
import os
import uuid
import urllib.request
import urllib.parse
from datetime import datetime

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()

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

def maybe_publish_to_vercel(entries):
    api_url = os.getenv("TRACKER_UPLOAD_URL", "").strip()
    secret = os.getenv("TRACKER_UPLOAD_SECRET", "").strip()
    if not api_url or not secret:
        return False

    payload = {
        "items": entries
    }

    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode('utf-8'),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {secret}'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            if resp.status >= 200 and resp.status < 300:
                return True
    except Exception as e:
        print("Publish failed:", e)
    return False

def call_gemini(prompt):
    if not GEMINI_API_KEY:
        return None
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

    # Best-effort publish to shared store (Supabase via Vercel API)
    maybe_publish_to_vercel([{
        "id": entry.get("id"),
        "date": entry.get("date"),
        "company": entry.get("company"),
        "agent": entry.get("agent"),
        "task": entry.get("task"),
        "status": entry.get("status"),
        "notes": entry.get("notes"),
        "created_by": os.getenv("TRACKER_CREATED_BY", "")
    }])

def show_input_dialog():
    root = tk.Tk()
    root.overrideredirect(True)
    root.configure(bg='#00ff00')
    
    window_width = 700
    window_height = 130
    
    root.update_idletasks()
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    x = (screen_width // 2) - (window_width // 2)
    y = (screen_height // 2) - (window_height // 2)
    root.geometry(f"{window_width}x{window_height}+{x}+{y}")
    root.attributes("-topmost", True)
    
    main_frame = tk.Frame(root, bg='#0a0a0a', bd=0)
    main_frame.pack(fill=tk.BOTH, expand=True, padx=2, pady=2)
    
    header_lbl = tk.Label(
        main_frame, 
        text="root@debors-tracker:~# Awaiting input... [AI & Clipboard Active]", 
        bg='#0a0a0a', 
        fg='#00ff00',
        font=('Consolas', 10, 'bold'),
        anchor='w'
    )
    header_lbl.pack(fill=tk.X, padx=15, pady=(15, 5))
    
    input_frame = tk.Frame(main_frame, bg='#0a0a0a')
    input_frame.pack(fill=tk.X, padx=15, pady=5)
    
    tk.Label(
        input_frame,
        text="> ",
        bg='#0a0a0a',
        fg='#00ff00',
        font=('Consolas', 14, 'bold')
    ).pack(side=tk.LEFT)
    
    entry = tk.Entry(
        input_frame, 
        font=('Consolas', 13), 
        bg='#0a0a0a', 
        fg='#00ff00', 
        insertbackground='#00ff00', 
        relief=tk.FLAT,
        bd=0
    )
    entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
    
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
            header_lbl.config(text="root@debors-tracker:~# Processing AI extraction...", fg='#00ffff')
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
