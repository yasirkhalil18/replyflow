import os
import sys
import subprocess

SYSTEMD_SERVICE_TEMPLATE = """[Unit]
Description=Discord Automation System 24/7 Independent Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory={cwd}
ExecStart={python_exec} run_system_247.py
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=discord-automation-bot

[Install]
WantedBy=multi-user.target
"""

def generate_deployment_files():
    cwd = os.path.dirname(os.path.abspath(__file__))
    python_exec = sys.executable

    # 1. Generate systemd service file
    service_path = os.path.join(cwd, "discord-bot.service")
    with open(service_path, "w", encoding="utf-8") as f:
        f.write(SYSTEMD_SERVICE_TEMPLATE.format(cwd=cwd, python_exec=python_exec))
    print(f"[OK] Generated Systemd Daemon file: {service_path}")

    print("\n========================================================")
    print("  INDEPENDENT 24/7 DEPLOYMENT INSTRUCTIONS")
    print("========================================================")
    print("Option A (Docker - 1-Click Independent Container):")
    print("   docker-compose -f docker-compose.bot.yml up -d --build")
    print("\nOption B (Linux VPS Daemon Service):")
    print("   sudo cp discord-bot.service /etc/systemd/system/")
    print("   sudo systemctl daemon-reload")
    print("   sudo systemctl enable discord-bot")
    print("   sudo systemctl start discord-bot")
    print("========================================================")

if __name__ == "__main__":
    generate_deployment_files()
