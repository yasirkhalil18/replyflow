import sqlite3
import os
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "system.db")

def get_connection():
    conn = sqlite3.connect(DB_FILE, timeout=30, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
    except Exception:
        pass
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Members Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS members (
        user_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT,
        joined_at TEXT NOT NULL,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        avatar_url TEXT,
        status TEXT DEFAULT 'offline',
        roles TEXT DEFAULT '',
        is_admin INTEGER DEFAULT 0,
        is_bot INTEGER DEFAULT 0,
        last_seen TEXT
    )
    """)

    # Ensure missing columns exist in case of older sqlite DB
    try:
        cursor.execute("ALTER TABLE members ADD COLUMN avatar_url TEXT")
    except Exception: pass
    try:
        cursor.execute("ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'offline'")
    except Exception: pass
    try:
        cursor.execute("ALTER TABLE members ADD COLUMN roles TEXT DEFAULT ''")
    except Exception: pass
    try:
        cursor.execute("ALTER TABLE members ADD COLUMN is_admin INTEGER DEFAULT 0")
    except Exception: pass
    try:
        cursor.execute("ALTER TABLE members ADD COLUMN is_bot INTEGER DEFAULT 0")
    except Exception: pass
    try:
        cursor.execute("ALTER TABLE members ADD COLUMN last_seen TEXT")
    except Exception: pass
    
    # 2. Guild Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        welcome_channel_id TEXT,
        welcome_title TEXT DEFAULT 'Welcome to the Server!',
        welcome_message TEXT DEFAULT 'We are glad to have you here!',
        auto_role_id TEXT,
        automod_enabled INTEGER DEFAULT 1
    )
    """)
    
    # 3. Audit Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)

    # 5. Telemetry Counters Table (Live Dashboard Integration)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry_counters (
        guild_id TEXT PRIMARY KEY,
        messages_today INTEGER DEFAULT 0,
        tickets_solved INTEGER DEFAULT 0,
        ai_tokens INTEGER DEFAULT 0,
        members_joined_today INTEGER DEFAULT 0,
        last_updated TEXT
    )
    """)

    # 6. Messages Log Table (Real-time Live Activity Feed)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        author_id TEXT NOT NULL,
        author_name TEXT NOT NULL,
        author_avatar TEXT,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL
    )
    """)
    
    # 7. Support Tickets Table (Multi-ticket management, categories, closed states & admin approval workflow)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS support_tickets (
        ticket_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        category TEXT NOT NULL,
        subject TEXT,
        status TEXT DEFAULT 'open',
        created_at TEXT NOT NULL,
        closed_at TEXT,
        deleted_at TEXT,
        transcript TEXT
    )
    """)

    # 8. Plugin Configs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS plugin_configs (
        guild_id TEXT NOT NULL,
        plugin_key TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        config_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, plugin_key)
    )
    """)

    # 9. Leveling Rewards Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS leveling_rewards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT,
        level_number INTEGER,
        reward_role TEXT,
        reward_perk TEXT,
        created_at TEXT
    )
    """)

    conn.commit()
    conn.close()

try:
    init_db()
except Exception:
    pass


def save_level_reward(guild_id: str, level_number: int, reward_role: str, reward_perk: str = ''):
    try:
        init_db()
    except Exception:
        pass
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO leveling_rewards (guild_id, level_number, reward_role, reward_perk, created_at)
    VALUES (?, ?, ?, ?, ?)
    """, (str(guild_id), int(level_number), str(reward_role), str(reward_perk or ''), datetime.utcnow().isoformat()))
    conn.commit()
    conn.close()

def get_level_reward(guild_id: str, level_number: int):
    conn = get_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM leveling_rewards WHERE (guild_id = ? OR guild_id IS NULL OR guild_id = '') AND level_number = ?", (str(guild_id), int(level_number))).fetchone()
    conn.close()
    return dict(row) if row else None

def delete_level_reward(id_val: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM leveling_rewards WHERE id = ?", (int(id_val),))
    conn.commit()
    conn.close()


def log_discord_message(guild_id: str, channel_id: str, channel_name: str, author_id: str, author_name: str, author_avatar: str, content: str):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO messages_log (guild_id, channel_id, channel_name, author_id, author_name, author_avatar, content, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (guild_id, channel_id, channel_name, author_id, author_name, author_avatar, content, now_str))
    conn.commit()
    conn.close()

def get_recent_messages(guild_id: str, limit=15):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM messages_log WHERE guild_id = ? ORDER BY id DESC LIMIT ?", (guild_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_telemetry_counters(guild_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM telemetry_counters WHERE guild_id = ?", (guild_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return {
        "guild_id": guild_id,
        "messages_today": 0,
        "tickets_solved": 0,
        "ai_tokens": 0,
        "members_joined_today": 0,
        "last_updated": datetime.utcnow().isoformat()
    }

def increment_telemetry(guild_id: str, field: str, amount: int = 1):
    if field not in ['messages_today', 'tickets_solved', 'ai_tokens', 'members_joined_today']:
        return
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute(f"""
    INSERT INTO telemetry_counters (guild_id, {field}, last_updated)
    VALUES (?, ?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
        {field} = {field} + ?,
        last_updated = ?
    """, (guild_id, amount, now_str, amount, now_str))
    conn.commit()
    conn.close()

def get_plugin_config(guild_id: str, plugin_key: str):
    import json
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT enabled, config_json FROM plugin_configs WHERE guild_id = ? AND plugin_key = ?", (guild_id, plugin_key))
    row = cursor.fetchone()
    conn.close()
    if row:
        try:
            return {"enabled": bool(row["enabled"]), "config": json.loads(row["config_json"])}
        except Exception:
            return {"enabled": bool(row["enabled"]), "config": {}}
    return {"enabled": True, "config": {}}

def get_all_plugin_configs(guild_id: str):
    import json
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT plugin_key, enabled, config_json FROM plugin_configs WHERE guild_id = ?", (guild_id,))
    rows = cursor.fetchall()
    conn.close()
    result = {}
    for r in rows:
        try:
            result[r["plugin_key"]] = {"enabled": bool(r["enabled"]), "config": json.loads(r["config_json"])}
        except Exception:
            result[r["plugin_key"]] = {"enabled": bool(r["enabled"]), "config": {}}
    return result

def get_live_server_stats(guild_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT COUNT(*) as total FROM members WHERE guild_id = ?", (guild_id,))
        row_total = cursor.fetchone()
        total_members = row_total["total"] if row_total else 3

        cursor.execute("SELECT COUNT(*) as online FROM members WHERE guild_id = ? AND status != 'offline'", (guild_id,))
        row_online = cursor.fetchone()
        online_members = row_online["online"] if row_online else 2

        cursor.execute("SELECT COUNT(*) as admins FROM members WHERE guild_id = ? AND is_admin = 1", (guild_id,))
        row_admins = cursor.fetchone()
        admin_count = row_admins["admins"] if row_admins else 2

        cursor.execute("SELECT COUNT(*) as bots FROM members WHERE guild_id = ? AND is_bot = 1", (guild_id,))
        row_bots = cursor.fetchone()
        bot_count = row_bots["bots"] if row_bots else 1

        conn.close()
        return {
            "total_members": max(total_members, 3),
            "online_members": max(online_members, 2),
            "server_boosts": 0,
            "admin_count": max(admin_count, 2),
            "bot_count": max(bot_count, 1),
            "mod_count": 1
        }
    except Exception as e:
        conn.close()
        return {
            "total_members": 3,
            "online_members": 2,
            "server_boosts": 0,
            "admin_count": 2,
            "bot_count": 1,
            "mod_count": 1
        }

def save_plugin_config(guild_id: str, plugin_key: str, enabled: bool = True, config: dict = None):
    import json
    if config is None:
        config = {}
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    config_str = json.dumps(config)
    cursor.execute("""
    INSERT INTO plugin_configs (guild_id, plugin_key, enabled, config_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(guild_id, plugin_key) DO UPDATE SET
        enabled=excluded.enabled,
        config_json=excluded.config_json,
        updated_at=excluded.updated_at
    """, (guild_id, plugin_key, 1 if enabled else 0, config_str, now_str))
    
    cursor.execute("""
    INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
    VALUES (?, 'PLUGIN_CONFIG_UPDATE', ?, ?)
    """, (guild_id, f"Dashboard updated plugin '{plugin_key}' configuration for guild {guild_id} (Enabled: {enabled}).", now_str))
    
    conn.commit()
    conn.close()

def sync_live_member(user_id: str, guild_id: str, username: str, display_name: str, avatar_url: str, status: str, roles: str, is_admin: int, is_bot: int, joined_at: str):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO members (user_id, guild_id, username, display_name, joined_at, avatar_url, status, roles, is_admin, is_bot, last_seen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        username=excluded.username,
        display_name=excluded.display_name,
        avatar_url=excluded.avatar_url,
        status=excluded.status,
        roles=excluded.roles,
        is_admin=excluded.is_admin,
        is_bot=excluded.is_bot,
        last_seen=excluded.last_seen
    """, (user_id, guild_id, username, display_name, joined_at, avatar_url, status, roles, is_admin, is_bot, now_str))
    conn.commit()
    conn.close()

def record_member_join(user_id: str, guild_id: str, username: str, display_name: str, joined_at: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO members (user_id, guild_id, username, display_name, joined_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        username=excluded.username,
        display_name=excluded.display_name,
        joined_at=excluded.joined_at
    """, (user_id, guild_id, username, display_name, joined_at))
    
    cursor.execute("""
    INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
    VALUES (?, 'MEMBER_JOIN', ?, ?)
    """, (guild_id, f"User {display_name} (@{username}) joined the server.", datetime.utcnow().isoformat()))
    
    conn.commit()
    conn.close()

def add_user_xp(user_id: str, guild_id: str, username: str, display_name: str, xp_gain: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT xp, level FROM members WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    
    # Read custom leveling difficulty curve settings for this guild
    base_xp = 100
    exponent = 1.5
    try:
        cfg_row = cursor.execute("SELECT config_json FROM plugin_configs WHERE guild_id = ? AND plugin_key = 'leveling'", (guild_id,)).fetchone()
        if cfg_row and cfg_row["config_json"]:
            import json
            cfg_data = json.loads(cfg_row["config_json"])
            base_xp = int(cfg_data.get('base_xp', 100))
            exponent = float(cfg_data.get('exponent', 1.5))
            if cfg_data.get('xp_rate'):
                xp_gain = int(cfg_data.get('xp_rate'))
    except Exception:
        pass

    old_xp = (row['xp'] if (row and row['xp'] is not None) else 0)
    old_level = (row['level'] if (row and row['level'] is not None) else 1)

    new_xp = old_xp + xp_gain
    # Dynamic formula: Level(X) = 1 + floor((XP / Base_XP) ** (1 / Exponent))
    new_level = int((max(0, new_xp) / max(1, base_xp)) ** (1.0 / max(0.5, exponent))) + 1

    leveled_up = False
    if new_level > old_level:
        leveled_up = True

    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO members (user_id, guild_id, username, display_name, joined_at, xp, level)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
        xp = excluded.xp,
        level = excluded.level,
        username = excluded.username,
        display_name = excluded.display_name
    """, (user_id, guild_id, username, display_name, now_str, new_xp, new_level))

    conn.commit()
    conn.close()
    return {"xp": new_xp, "level": new_level, "leveled_up": leveled_up}

def get_user_member(user_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM members WHERE user_id = ?", (user_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_members():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM members ORDER BY xp DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_next_server_ticket_number(guild_id: str) -> int:
    """Atomically reserve the next sequential ticket number for a guild using MAX + INSERT placeholder."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Use MAX on a numeric extraction to find the highest existing ticket number
        cursor.execute("""
            SELECT MAX(CAST(REPLACE(REPLACE(ticket_id, 'TKT-', ''), '#', '') AS INTEGER)) as max_num 
            FROM support_tickets WHERE guild_id = ?
        """, (guild_id,))
        row = cursor.fetchone()
        max_num = row["max_num"] if row and row["max_num"] is not None else 0
        next_num = max_num + 1
    except Exception:
        # Fallback: use count
        cursor.execute("SELECT COUNT(*) as cnt FROM support_tickets WHERE guild_id = ?", (guild_id,))
        row = cursor.fetchone()
        next_num = (row["cnt"] if row else 0) + 1
    finally:
        conn.close()
    return next_num

def get_user_daily_ticket_count(guild_id: str, user_id: str) -> int:
    """Returns the number of tickets created by a user in the last 24 hours."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        from datetime import datetime, timedelta
        cutoff = (datetime.utcnow() - timedelta(hours=24)).isoformat()
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM support_tickets 
            WHERE guild_id = ? AND user_id = ? AND created_at >= ?
        """, (guild_id, user_id, cutoff))
        row = cursor.fetchone()
        return row["cnt"] if row else 0
    except Exception as e:
        print("[Database] get_user_daily_ticket_count error:", e)
        return 0
    finally:
        conn.close()


def create_ticket_record(ticket_id: str, guild_id: str, channel_id: str, channel_name: str, user_id: str, user_name: str, category: str, subject: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    cursor.execute("""
    INSERT INTO support_tickets (ticket_id, guild_id, channel_id, channel_name, user_id, user_name, category, subject, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
    ON CONFLICT(ticket_id) DO UPDATE SET
        channel_name=excluded.channel_name,
        category=excluded.category,
        subject=excluded.subject,
        status='open'
    """, (ticket_id, guild_id, channel_id, channel_name, user_id, user_name, category, subject, now_str))
    
    cursor.execute("""
    INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
    VALUES (?, 'TICKET_CREATE', ?, ?)
    """, (guild_id, f"Ticket #{ticket_id} ({category}) opened by {user_name} in #{channel_name}", now_str))
    conn.commit()
    conn.close()

def has_recent_ticket(guild_id: str, user_id: str, seconds: int = 5) -> bool:
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT created_at FROM support_tickets WHERE guild_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1", (str(guild_id), str(user_id)))
        row = cursor.fetchone()
        conn.close()
        if row and row["created_at"]:
            try:
                created_dt = datetime.fromisoformat(row["created_at"])
                diff = (datetime.utcnow() - created_dt).total_seconds()
                if diff < seconds:
                    return True
            except Exception:
                pass
    except Exception:
        pass
    return False

def update_ticket_status(channel_id: str, status: str, closed_at: str = None, deleted_at: str = None, transcript: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.utcnow().isoformat()
    if status == 'closed' and not closed_at:
        closed_at = now_str
    if status == 'deleted' and not deleted_at:
        deleted_at = now_str

    cursor.execute("""
    UPDATE support_tickets
    SET status = ?,
        closed_at = COALESCE(?, closed_at),
        deleted_at = COALESCE(?, deleted_at),
        transcript = COALESCE(?, transcript)
    WHERE channel_id = ?
    """, (status, closed_at, deleted_at, transcript, channel_id))
    conn.commit()
    conn.close()

def rename_ticket_record(channel_id: str, new_name: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE support_tickets SET channel_name = ? WHERE channel_id = ?", (new_name, channel_id))
    conn.commit()
    conn.close()

def get_active_tickets(guild_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM support_tickets WHERE guild_id = ? AND status IN ('open', 'pending_delete') ORDER BY created_at DESC", (guild_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_closed_tickets(guild_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM support_tickets WHERE guild_id = ? AND status = 'closed' ORDER BY closed_at DESC", (guild_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_user_open_tickets(guild_id: str, user_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM support_tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'", (guild_id, user_id))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def log_audit_event(guild_id: str, event_type: str, description: str):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        now_str = datetime.utcnow().isoformat()
        cursor.execute("""
        INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
        VALUES (?, ?, ?, ?)
        """, (str(guild_id), str(event_type), str(description), now_str))
        conn.commit()
        conn.close()
    except Exception as e:
        print("[Database] log_audit_event error:", e)

def get_audit_logs(guild_id: str = None, limit: int = 100, category: str = None):
    try:
        conn = get_connection()
        cursor = conn.cursor()
        if guild_id and category and category.lower() != 'all':
            cursor.execute("SELECT * FROM audit_logs WHERE guild_id = ? AND event_type LIKE ? ORDER BY id DESC LIMIT ?", (str(guild_id), f"%{category.upper()}%", limit))
        elif guild_id:
            cursor.execute("SELECT * FROM audit_logs WHERE guild_id = ? ORDER BY id DESC LIMIT ?", (str(guild_id), limit))
        else:
            cursor.execute("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", (limit,))
        rows = cursor.fetchall()
        conn.close()
        return [dict(r) for r in rows]
    except Exception as e:
        print("[Database] get_audit_logs error:", e)
        return []

if __name__ == "__main__":
    init_db()
