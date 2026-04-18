import flask
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import os
import platform

app = Flask(__name__)
CORS(app)  # Разрешаем браузеру присылать команды

@app.route('/execute', methods=['POST'])
def execute():
    data = request.json
    action = data.get('action')
    params = data.get('params', {})
    
    print(f"[*] Получена команда: {action} с параметрами {params}")
    
    try:
        if action == 'open_app':
            # Для Windows: start <имя>
            os.system(f"start {params['name']}")
            return jsonify({"status": "success", "msg": f"Launched {params['name']}"})
            
        elif action == 'open_url':
            os.system(f"start {params['url']}")
            return jsonify({"status": "success", "msg": f"Opened URL: {params['url']}"})
            
        elif action == 'run_command':
            # Запуск команды в новом окне консоли, чтобы вы видели результат
            cmd = params['cmd']
            subprocess.Popen(['cmd', '/c', 'start', 'cmd', '/k', cmd], shell=True)
            return jsonify({"status": "success", "msg": f"Executed: {cmd}"})
            
        elif action == 'system_control':
            act = params['action']
            if act == 'shutdown':
                os.system("shutdown /s /t 60")
            elif act == 'restart':
                os.system("shutdown /r /t 60")
            return jsonify({"status": "success", "msg": f"System action: {act}"})

        return jsonify({"status": "error", "msg": "Unknown action"}), 400
        
    except Exception as e:
        return jsonify({"status": "error", "msg": str(e)}), 500

if __name__ == '__main__':
    print("--- WinAutomate Runner запущен ---")
    print("Слушаю команды на http://127.0.0.1:5000 (LOCAL ONLY)")
    print("Нажмите Ctrl+C для выхода")
    app.run(host='127.0.0.1', port=5000)
