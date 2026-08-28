import subprocess
import time
import sys
import os

def run_supervisor():
    print("========================================================")
    print("  Starting Discord Automation System 24/7 Supervisor")
    print("========================================================")
    
    python_cmd = sys.executable
    cwd = os.path.dirname(os.path.abspath(__file__))
    
    bot_process = None
    server_process = None
    
    while True:
        # Check & start Bot Service
        if bot_process is None or bot_process.poll() is not None:
            print("[Supervisor] Launching Discord Bot Event Listener (bot_service.py)...")
            bot_process = subprocess.Popen([python_cmd, "-u", "bot_service.py"], cwd=cwd)
            
        # Check & start Web Dashboard Server (Port 3000)
        if server_process is None or server_process.poll() is not None:
            print("[Supervisor] Launching Web Dashboard Server on http://localhost:3000 (server.py)...")
            server_process = subprocess.Popen([python_cmd, "-u", "server.py"], cwd=cwd)

        time.sleep(10)

if __name__ == "__main__":
    run_supervisor()
