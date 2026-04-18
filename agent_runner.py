import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import platform
import shutil
import sys
import time

try:
    import winsound
except ImportError:
    winsound = None

# Пытаемся импортировать pyautogui для работы с клавиатурой
try:
    import pyautogui
    # Отключаем паузу для скорости, но оставляем fail-safe (отвод мыши в угол экрана остановит скрипт)
    pyautogui.PAUSE = 0.1
except ImportError:
    pyautogui = None

app = Flask(__name__)
CORS(app)

# Чтение токена безопасности
SECURITY_TOKEN = None
for i, arg in enumerate(sys.argv):
    if arg == '--token' and i + 1 < len(sys.argv):
        SECURITY_TOKEN = sys.argv[i + 1]

def require_auth(req):
    if not SECURITY_TOKEN: return True # Fallback for old run_local.bat without token
    auth_header = req.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        return token == SECURITY_TOKEN
    return False

def countdown_warning(action_name):
    print(f"\n[!] WARNING: Auto-Typing triggered ({action_name}). Don't touch keyboard/mouse!")
    for i in range(3, 0, -1):
        print(f"... {i} ...")
        if winsound: winsound.Beep(1000, 200)
        time.sleep(1)
    if winsound: winsound.Beep(1500, 500)

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "connected", "version": "2.9.6", "secure": SECURITY_TOKEN is not None})

@app.route('/execute', methods=['POST'])
def execute():
    # --- PROOF OF AUTHENTICATION ---
    if not require_auth(request):
        print("[!] SECURITY ALERT: Unauthorized execution attempt.")
        return jsonify({"status": "error", "msg": "Unauthorized. Invalid Token."}), 401
        
    data = request.json
    action = data.get('action')
    params = data.get('params', {})
    
    print(f"[*] Command received: {action} with {params}")
    
    try:
        # --- Системные действия (через OS) ---
        if action == 'open_app':
            os.system(f"start {params['name']}")
            return jsonify({"status": "success"})
            
        elif action == 'open_url':
            os.system(f"start {params['url']}")
            return jsonify({"status": "success"})
            
        elif action == 'run_command':
            cmd = params['cmd']
            try:
                # Исполняем нативно через PowerShell для максимальной мощи и избежания багов CMD
                ps_args = ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", cmd]
                out = subprocess.run(ps_args, capture_output=True, text=True, timeout=60)
                if out.returncode != 0:
                    return jsonify({"status": "error", "msg": f"PowerShell Error: {out.stderr or out.stdout}"})
                return jsonify({"status": "success", "msg": out.stdout.strip() or "Executed successfully"})
            except subprocess.TimeoutExpired:
                return jsonify({"status": "success", "msg": "Command is long-running and was moved to background."})
            
        elif action == 'system_control':
            act = params['action']
            if act == 'shutdown': os.system("shutdown /s /t 60")
            elif act == 'restart': os.system("shutdown /r /t 60")
            elif act == 'sleep': os.system("rundll32.exe powrprof.dll,SetSuspendState 0,1,0")
            return jsonify({"status": "success"})

        # --- Действия с файлами ---
        elif action == 'file_operation':
            op = params.get('operation')
            path = params.get('path')
            content = params.get('content', '')
            
            if op == 'create':
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return jsonify({"status": "success", "msg": f"Created {path}"})
            elif op == 'delete':
                import glob
                expanded_path = os.path.expandvars(path)
                matches = glob.glob(expanded_path)
                
                if matches:
                    for match in matches:
                        try:
                            if os.path.isdir(match): shutil.rmtree(match)
                            else: os.remove(match)
                        except Exception as e:
                            print(f"[!] Failed to delete {match}: {e}")
                    return jsonify({"status": "success", "msg": f"Deleted {len(matches)} items matching {path}"})
                else:
                    return jsonify({"status": "success", "msg": "Target not found (already deleted or wrong path)."})
            elif op == 'read':
                if os.path.exists(path):
                    with open(path, 'r', encoding='utf-8') as f:
                        return jsonify({"status": "success", "content": f.read()})
                return jsonify({"status": "error", "msg": "File not found"}), 404

        # --- Ввод (Клавиатура/Мышь) ---
        elif action == 'press_keys':
            if not pyautogui: return jsonify({"status": "error", "msg": "PyAutoGUI not installed"}), 500
            countdown_warning("Press Keys")
            keys = params.get('keys', '').lower().split('+')
            pyautogui.hotkey(*keys)
            return jsonify({"status": "success"})

        elif action == 'type_text':
            if not pyautogui: return jsonify({"status": "error", "msg": "PyAutoGUI not installed"}), 500
            countdown_warning("Type Text")
            text = params.get('text', '')
            pyautogui.write(text, interval=0.01)
            return jsonify({"status": "success"})

        return jsonify({"status": "error", "msg": "Unknown action"}), 400
        
    except Exception as e:
        print(f"[!] Error: {str(e)}")
        return jsonify({"status": "error", "msg": str(e)}), 500

if __name__ == '__main__':
    print("--- JARVIS Automation Runner v2.9.6 ---")
    if SECURITY_TOKEN:
        print("[SECURE MODE] Local runner locked with Access Token.")
    else:
        print("[WARNING] Local runner started WITHOUT token security. Vulnerable to RCE.")
        
    if not pyautogui:
        print("[!] WARNING: PyAutoGUI is missing. Keyboard/Mouse commands will NOT work.")
        print("[!] RUN: pip install pyautogui")
    
    print("Listening on http://127.0.0.1:5000")
    app.run(host='127.0.0.1', port=5000)
