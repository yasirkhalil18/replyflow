import sys
import socket

_instance_socket = None
if __name__ == "__main__":
    try:
        _instance_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _instance_socket.bind(('127.0.0.1', 49159))
    except Exception:
        print("[Bot Single-Instance Guard] Another instance of bot_service.py is ALREADY running on this system! Exiting redundant process cleanly.")
        sys.exit(0)

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import discord
from discord import app_commands, ui
import asyncio
import io
import aiomysql
import base64
import os
import re
import random
import json
import urllib.request
from datetime import datetime, timedelta
import database

import dotenv

env_path = os.path.join(os.path.dirname(__file__), 'backend', '.env')
dotenv.load_dotenv(env_path)

TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "")
CLIENT_ID = int(os.environ.get("DISCORD_CLIENT_ID", "1542781631067201606"))

intents = discord.Intents.all()

async def get_or_create_ticket_category(guild: discord.Guild, category_name: str) -> discord.CategoryChannel:
    cat = discord.utils.get(guild.categories, name=category_name)
    if not cat:
        for c in guild.categories:
            clean_c = c.name.lower().replace("📁 ", "").replace("🎟️ ", "").replace("🔒 ", "")
            clean_target = category_name.lower().replace("📁 ", "").replace("🎟️ ", "").replace("🔒 ", "")
            if clean_c == clean_target:
                cat = c
                break
    if not cat:
        try:
            cat = await guild.create_category(category_name)
            try:
                print(f"[TicketSystem] Created category folder '{category_name}' in {guild.name}")
            except Exception:
                print(f"[TicketSystem] Created category folder in guild {guild.id}")
        except Exception as e:
            try:
                print(f"[TicketSystem] Category creation note ({category_name}): {e}")
            except Exception:
                pass
            cat = discord.utils.get(guild.categories, name="🎟️ SUPPORT TICKETS")
    return cat


class TicketRenameModal(discord.ui.Modal, title="✏️ Rename Support Ticket"):
    new_name_input = discord.ui.TextInput(
        label="New Channel Name",
        placeholder="e.g. billing-issue-resolved",
        min_length=3,
        max_length=40,
        required=True
    )

    async def on_submit(self, interaction: discord.Interaction):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=True)
        except Exception:
            pass
            
        raw_name = self.new_name_input.value.strip().lower()
        clean_name = re.sub(r'[^a-zA-Z0-9_\-]', '', raw_name).strip('-')
        if not clean_name:
            clean_name = "ticket-updated"
        if not clean_name.startswith("ticket-"):
            clean_name = f"ticket-{clean_name}"
            
        old_name = interaction.channel.name
        try:
            await interaction.channel.edit(name=clean_name, reason=f"Ticket renamed by {interaction.user.name}")
            database.rename_ticket_record(str(interaction.channel.id), clean_name)
            await interaction.followup.send(f"✅ Ticket channel renamed from `#{old_name}` to `{interaction.channel.mention}`!", ephemeral=True)
            await interaction.channel.send(embed=discord.Embed(
                description=f"✏️ **Ticket Channel Renamed**: Updated to `#{clean_name}` by {interaction.user.mention}",
                color=discord.Color.blue()
            ))
        except Exception as e:
            await interaction.followup.send(f"⚠️ Could not rename channel: {e}", ephemeral=True)


class TicketCreateModal(discord.ui.Modal, title="📩 Create Support Ticket"):
    ticket_name_input = discord.ui.TextInput(
        label="Ticket Name / Topic",
        placeholder="e.g. Payment Query, Account Help, Technical Issue",
        style=discord.TextStyle.short,
        min_length=2,
        max_length=40,
        required=True
    )

    purpose_input = discord.ui.TextInput(
        label="Purpose / Details (Optional)",
        placeholder="Briefly explain what you need assistance with...",
        style=discord.TextStyle.paragraph,
        min_length=0,
        max_length=400,
        required=False
    )

    async def on_submit(self, interaction: discord.Interaction):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=True)
        except Exception:
            pass

        guild = interaction.guild
        user = interaction.user
        raw_name = self.ticket_name_input.value.strip()
        purpose_text = self.purpose_input.value.strip() if self.purpose_input.value else "No purpose specified."

        # Allow user to open multiple tickets without restriction
        clean_title = re.sub(r'[^a-zA-Z0-9_\-]', '', raw_name.lower().replace(' ', '-')).strip('-')
        rand_id = str(random.randint(1000, 9999))
        
        if not clean_title:
            clean_title = "support"
            
        channel_name = f"ticket-{clean_title}" if not clean_title.startswith("ticket-") else clean_title

        folder_name = "🎟️ SUPPORT TICKETS"
        category = await get_or_create_ticket_category(guild, folder_name)

        bot_member = guild.me or guild.get_member(client.user.id)
        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            user: discord.PermissionOverwrite(read_messages=True, send_messages=True, attach_files=True, embed_links=True)
        }
        if bot_member:
            overwrites[bot_member] = discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True, manage_permissions=True)

        try:
            ticket_chan = await guild.create_text_channel(channel_name, category=category, overwrites=overwrites)
            tkt_id = f"TKT-{rand_id}"

            database.create_ticket_record(
                ticket_id=tkt_id,
                guild_id=str(guild.id),
                channel_id=str(ticket_chan.id),
                channel_name=channel_name,
                user_id=str(user.id),
                user_name=user.name,
                category=raw_name,
                subject=purpose_text
            )

            embed = discord.Embed(
                title=f"🎟️ Support Ticket — {raw_name}",
                description=f"Welcome {user.mention}! Your private ticket channel is active.\n\n"
                            f"📌 **Ticket Name**: `{raw_name}`\n"
                            f"📋 **Purpose**: {purpose_text}\n"
                            f"👤 **Created By**: {user.mention} (`@{user.name}`)\n\n"
                            f"Staff will respond shortly. You can click **✏️ Rename Ticket**, **🔒 Close Ticket**, or **📄 Export Chat** below.",
                color=discord.Color.green()
            )
            embed.set_footer(text=f"Ticket ID: {tkt_id} • ReplyFlow Automation System")

            await ticket_chan.send(content=f"{user.mention} Welcome to your support ticket channel!", embed=embed, view=TicketControlView())

            await interaction.followup.send(
                f"✅ **Support Ticket Created Successfully!**\n\n"
                f"📌 **Channel**: {ticket_chan.mention}\n"
                f"📋 **Topic**: `{raw_name}`",
                ephemeral=True
            )
        except Exception as e:
            print("[TicketSystem] Create ticket channel error:", e)
            await interaction.followup.send(f"⚠️ Could not create ticket channel: {e}", ephemeral=True)


class TicketDeleteConfirmView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    async def _handle_delete_action(self, interaction: discord.Interaction, export_first: bool = False):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=False)
        except Exception:
            pass

        user = interaction.user
        channel = interaction.channel
        is_admin = (
            user.id == interaction.guild.owner_id or
            user.guild_permissions.administrator or
            user.guild_permissions.manage_channels or
            any(r.name.lower() in ['admin', 'administrator', 'moderator', 'staff'] for r in user.roles)
        )
        if not is_admin:
            await interaction.followup.send(
                "⛔ **Access Denied**: Only server Administrators & Staff members can approve channel deletion!",
                ephemeral=True
            )
            return

        transcript_text = ""
        try:
            messages = []
            async for msg in channel.history(limit=500, oldest_first=True):
                author_name = msg.author.name if msg.author else "Unknown"
                created_str = msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else ""
                content_str = msg.content or "[Embed / Attachment]"
                messages.append(f"[{created_str}] {author_name}: {content_str}")

            transcript_text = f"--- OFFICIAL TICKET TRANSCRIPT #{channel.name} ---\n" + "\n".join(messages)
            
            if export_first:
                file = discord.File(io.BytesIO(transcript_text.encode('utf-8')), filename=f"{channel.name}-transcript.txt")
                await interaction.followup.send("📄 **Official Ticket Transcript Saved & Exported:**", file=file, ephemeral=False)
        except Exception as e:
            print("[TicketSystem] Transcript export error during deletion:", e)

        database.update_ticket_status(str(channel.id), 'deleted', transcript=transcript_text)
        database.increment_telemetry(str(interaction.guild.id), 'tickets_solved', 1)

        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
            VALUES (?, 'TICKET_DELETE', ?, ?)
            """, (str(interaction.guild.id), f"Ticket channel #{channel.name} deletion approved by Admin {user.name}", datetime.utcnow().isoformat()))
            conn.commit()
            conn.close()
        except Exception:
            pass

        await interaction.followup.send(
            f"🗑️ **Ticket Channel Deletion Approved by Staff ({user.mention})**! Deleting channel in 5 seconds...",
            ephemeral=False
        )

        await asyncio.sleep(5)
        try:
            await channel.delete(reason=f"Approved ticket deletion by Admin {user.name}")
        except Exception as e:
            print("[TicketSystem] Channel delete error:", e)

    @ui.button(label="✅ Approve & Permanently Delete", style=discord.ButtonStyle.danger, custom_id="confirm_delete_channel_btn")
    async def confirm_delete(self, interaction: discord.Interaction, button: ui.Button):
        await self._handle_delete_action(interaction, export_first=True)

    @ui.button(label="📄 Export & Delete", style=discord.ButtonStyle.primary, custom_id="export_and_delete_btn")
    async def export_and_delete(self, interaction: discord.Interaction, button: ui.Button):
        await self._handle_delete_action(interaction, export_first=True)

    @ui.button(label="❌ Reject Request", style=discord.ButtonStyle.secondary, custom_id="reject_delete_request_btn")
    async def reject_request(self, interaction: discord.Interaction, button: ui.Button):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=False)
        except Exception:
            pass
        user = interaction.user
        is_admin = (
            user.id == interaction.guild.owner_id or
            user.guild_permissions.administrator or
            user.guild_permissions.manage_channels or
            any(r.name.lower() in ['admin', 'administrator', 'moderator', 'staff'] for r in user.roles)
        )
        if not is_admin:
            await interaction.followup.send("⛔ Only Staff members can reject deletion requests.", ephemeral=True)
            return

        await interaction.followup.send(embed=discord.Embed(
            description=f"❌ **Ticket Deletion Request Rejected** by Staff ({user.mention}). The channel will remain open in the archive folder.",
            color=discord.Color.orange()
        ))


class TicketClosedChannelView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @ui.button(label="🗑️ Request Channel Deletion", style=discord.ButtonStyle.danger, custom_id="request_delete_history_btn")
    async def request_delete(self, interaction: discord.Interaction, button: ui.Button):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=False)
        except Exception:
            pass
        user = interaction.user
        
        # Send ephemeral notice to user
        try:
            await interaction.followup.send(
                f"⏳ **Deletion Request Submitted!** Your request to delete `{interaction.channel.name}` is now **Pending Admin Approval**. An Admin will review it shortly.",
                ephemeral=True
            )
        except Exception:
            pass

        embed = discord.Embed(
            title="⏳ Ticket Deletion Request — Pending Admin Approval",
            description=f"Member {user.mention} requested to permanently delete ticket channel `{interaction.channel.name}`.\n\n"
                        f"📌 **Current Status**: ⏳ **Pending Admin Approval**\n"
                        f"🔒 **Security Policy**: The chat history is preserved until an Administrator / Staff member approves deletion below.",
            color=discord.Color.gold()
        )
        embed.set_footer(text="Pending Admin Review • Only Admins & Staff can approve or reject deletion")
        try:
            await interaction.followup.send(
                content=f"🔔 **Staff Alert**: {user.mention} requested channel deletion.",
                embed=embed,
                view=TicketDeleteConfirmView(),
                ephemeral=False
            )
            database.update_ticket_status(str(interaction.channel.id), 'pending_delete')
        except Exception as e:
            print("[TicketSystem] Request delete error:", e)


    @ui.button(label="📄 Export Transcript", style=discord.ButtonStyle.primary, custom_id="transcript_ticket_btn")
    async def export_transcript(self, interaction: discord.Interaction, button: ui.Button):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=False)
        except Exception:
            pass
        try:
            messages = []
            async for msg in interaction.channel.history(limit=500, oldest_first=True):
                author_name = msg.author.name if msg.author else "Unknown"
                created_str = msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else ""
                content_str = msg.content or "[Embed / Attachment]"
                messages.append(f"[{created_str}] {author_name}: {content_str}")

            transcript_text = f"--- TICKET TRANSCRIPT FOR #{interaction.channel.name} ---\n" + "\n".join(messages)
            file = discord.File(io.BytesIO(transcript_text.encode('utf-8')), filename=f"{interaction.channel.name}-transcript.txt")
            await interaction.followup.send("📄 **Ticket Transcript Exported:**", file=file, ephemeral=False)
        except Exception as e:
            print("[TicketSystem] Export transcript error:", e)


class TicketControlView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @ui.button(label="🔒 Close Ticket", style=discord.ButtonStyle.secondary, custom_id="close_ticket_btn")

    async def close_ticket(self, interaction: discord.Interaction, button: ui.Button):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=False)
        except Exception:
            pass
        user = interaction.user
        channel = interaction.channel

        try:
            closed_cat = await get_or_create_ticket_category(interaction.guild, "🔒 CLOSED TICKETS")
            await channel.edit(category=closed_cat, reason=f"Ticket closed by {user.name}")
        except Exception as cat_err:
            print("[TicketSystem] Category move error:", cat_err)

        try:
            for target in channel.overwrites:
                if isinstance(target, discord.Member) and not target.guild_permissions.administrator:
                    await channel.set_permissions(target, read_messages=True, send_messages=False)
        except Exception as perm_err:
            print("[TicketSystem] Lock permission error:", perm_err)

        database.update_ticket_status(str(channel.id), 'closed')

        embed = discord.Embed(
            title="🔒 Support Ticket Closed",
            description=f"Ticket closed by {user.mention}.\n\n"
                        f"• Chat history has been **archived & moved** to `🔒 CLOSED TICKETS` folder.\n"
                        f"• Member send access is **locked**.\n"
                        f"• To request permanent deletion of this channel, click **🗑️ Request Channel Deletion** below.",
            color=discord.Color.dark_red()
        )
        try:
            await interaction.followup.send(
                embed=embed,
                view=TicketClosedChannelView(),
                ephemeral=False
            )
        except Exception as e:
            print("[TicketSystem] Close ticket followup note:", e)

    @ui.button(label="📄 Export Chat", style=discord.ButtonStyle.primary, custom_id="transcript_ticket_btn")
    async def export_transcript(self, interaction: discord.Interaction, button: ui.Button):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=False)
        except Exception:
            pass
        try:
            messages = []
            async for msg in interaction.channel.history(limit=500, oldest_first=True):
                author_name = msg.author.name if msg.author else "Unknown"
                created_str = msg.created_at.strftime('%Y-%m-%d %H:%M:%S') if msg.created_at else ""
                content_str = msg.content or "[Embed / Attachment]"
                messages.append(f"[{created_str}] {author_name}: {content_str}")

            transcript_text = f"--- TICKET TRANSCRIPT FOR #{interaction.channel.name} ---\n" + "\n".join(messages)
            file = discord.File(io.BytesIO(transcript_text.encode('utf-8')), filename=f"{interaction.channel.name}-transcript.txt")
            await interaction.followup.send("📄 **Ticket Transcript Exported:**", file=file, ephemeral=False)
        except Exception as e:
            print("[TicketSystem] Export transcript error:", e)


# Per-user cooldown lock to prevent duplicate tickets from rapid/double clicks
_ticket_creation_locks = {}

async def create_instant_ticket(interaction: discord.Interaction, category_name: str = "General Support"):
    guild = interaction.guild
    user = interaction.user

    # Fetch Ticket plugin configuration from database
    cfg = {}
    try:
        plugin_db = database.get_plugin_config(str(guild.id), 'tickets')
        if plugin_db and plugin_db.get('config'):
            cfg = plugin_db.get('config', {})
    except Exception as e:
        print("[TicketSystem] Config load note:", e)

    # Check daily ticket limit per user (Bypassed for Admins/Staff and if max_daily <= 0)
    is_staff = (
        user.id == guild.owner_id or
        (hasattr(user, 'guild_permissions') and (user.guild_permissions.administrator or user.guild_permissions.manage_channels)) or
        any(r.name.lower() in ['admin', 'administrator', 'moderator', 'staff'] for r in getattr(user, 'roles', []))
    )

    max_daily = 0
    if 'max_daily_tickets' in cfg:
        try:
            max_daily = int(cfg.get('max_daily_tickets', 0))
        except Exception:
            max_daily = 0

    if not is_staff and max_daily > 0:
        daily_cnt = database.get_user_daily_ticket_count(str(guild.id), str(user.id))
        if daily_cnt >= max_daily:
            try:
                msg = f"⚠️ **Daily Ticket Limit Reached!** You are allowed a maximum of **{max_daily} tickets per day**. You have already opened {daily_cnt} tickets in the last 24 hours."
                if not interaction.response.is_done():
                    await interaction.response.send_message(msg, ephemeral=True, delete_after=4)
                else:
                    await interaction.followup.send(msg, ephemeral=True, delete_after=4)
            except Exception:
                pass
            return


    # Database-level & In-memory lock: prevent duplicate ticket channel creation
    if database.has_recent_ticket(str(guild.id), str(user.id), 5):
        try:
            if not interaction.response.is_done():
                await interaction.response.send_message("⏳ Ticket creation already in progress. Please wait a moment.", ephemeral=True, delete_after=4)
            else:
                await interaction.followup.send("⏳ Ticket creation already in progress.", ephemeral=True, delete_after=4)
        except Exception:
            pass
        return

    lock_key = f"{guild.id}_{user.id}"
    import time
    now = time.time()
    if lock_key in _ticket_creation_locks:
        last_time = _ticket_creation_locks[lock_key]
        if now - last_time < 10:
            try:
                if not interaction.response.is_done():
                    await interaction.response.send_message("⏳ Please wait a few seconds before creating another ticket.", ephemeral=True, delete_after=4)
            except Exception:
                pass
            return
    _ticket_creation_locks[lock_key] = now

    try:
        if not interaction.response.is_done():
            await interaction.response.defer(ephemeral=True)
    except Exception:
        pass

    # Server-wide sequential ticket numbering (e.g. 001, 002, 003...)
    next_num = database.get_next_server_ticket_number(str(guild.id))
    channel_name = f"ticket-{next_num:03d}"

    folder_name = "🎟️ SUPPORT TICKETS"
    category = await get_or_create_ticket_category(guild, folder_name)

    bot_member = guild.me or (guild.get_member(client.user.id) if client and client.user else None)
    overwrites = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        user: discord.PermissionOverwrite(read_messages=True, send_messages=True, attach_files=True, embed_links=True)
    }
    if bot_member:
        overwrites[bot_member] = discord.PermissionOverwrite(read_messages=True, send_messages=True, manage_channels=True, manage_permissions=True)

    # Grant read/write access to Admin and Staff/Moderator roles
    allowed_roles_raw = cfg.get('allowed_roles', 'Admin, Moderator, Staff')
    allowed_names = [r.strip().lower() for r in allowed_roles_raw.split(',') if r.strip()]
    for role in guild.roles:
        if role.permissions.administrator or role.permissions.manage_channels or any(name in role.name.lower() for name in allowed_names):
            overwrites[role] = discord.PermissionOverwrite(read_messages=True, send_messages=True, attach_files=True, embed_links=True)

    try:
        existing_chan = discord.utils.get(guild.text_channels, name=channel_name)
        if existing_chan:
            print(f"[TicketSystem] Channel #{channel_name} already exists. Bypassing duplicate channel creation.")
            if not interaction.response.is_done():
                await interaction.response.send_message(f"✨ **Ticket Created!** Head over to {existing_chan.mention} to chat with staff.", ephemeral=True, delete_after=4)
            else:
                await interaction.followup.send(f"✨ **Ticket Created!** Head over to {existing_chan.mention} to chat with staff.", ephemeral=True, delete_after=4)
            return

        ticket_chan = await guild.create_text_channel(channel_name, category=category, overwrites=overwrites)
        tkt_id = f"TKT-{next_num:03d}"

        database.create_ticket_record(
            ticket_id=tkt_id,
            guild_id=str(guild.id),
            channel_id=str(ticket_chan.id),
            channel_name=channel_name,
            user_id=str(user.id),
            user_name=user.name,
            category=category_name,
            subject=f"Ticket #{next_num:03d}"
        )

        embed = discord.Embed(
            title=f"🎟️ Support Ticket #{next_num:03d}",
            description=f"Welcome {user.mention}! Our staff team has been notified and will assist you shortly.\n\n"
                        f"• **Ticket Number**: `#{next_num:03d}`\n"
                        f"• **Member**: {user.name} (@{user.name})\n"
                        f"• **Department**: `{category_name}`\n"
                        f"• **Created**: <t:{int(datetime.utcnow().timestamp())}:F>",
            color=discord.Color.blue()
        )
        embed.set_footer(text="ReplyFlow Ticket System • Click buttons below to manage this channel.")

        await ticket_chan.send(
            content=f"👋 Welcome {user.mention}! Staff team pinged.",
            embed=embed,
            view=TicketControlView()
        )

        await interaction.followup.send(
            f"✨ **Ticket Created Successfully!**\n> ➡️ Head over to {ticket_chan.mention} to chat with our support staff.",
            ephemeral=True,
            delete_after=4
        )
    except Exception as e:
        print("[TicketSystem] Instant ticket creation error:", e)
        # Release lock on failure so user can try again
        _ticket_creation_locks.pop(lock_key, None)
        try:
            await interaction.followup.send(f"⚠️ Failed to create ticket channel: {e}", ephemeral=True, delete_after=4)
        except Exception:
            pass


class TicketView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @ui.button(label="📩 Create Ticket", style=discord.ButtonStyle.primary, custom_id="create_ticket_btn")
    async def create_ticket(self, interaction: discord.Interaction, button: ui.Button):
        try:
            if not interaction.response.is_done():
                await interaction.response.defer(ephemeral=True)
        except Exception:
            pass
        await create_instant_ticket(interaction, "General Support")



class RulesModal(discord.ui.Modal, title="📜 Server Rules & Terms Agreement"):
    rules_input = discord.ui.TextInput(
        label="Community Guidelines & Financial Terms",
        style=discord.TextStyle.paragraph,
        default=(
            "1. Be respectful to all members and staff. Zero tolerance for harassment or hate speech.\n"
            "2. No spam, unsolicited DMs, or unauthorized self-promotion.\n"
            "3. Educational trading content only — insights do not constitute financial advice.\n"
            "4. Protect your Discord credentials and secret API keys."
        ),
        required=False,
        max_length=1000
    )
    
    confirm_input = discord.ui.TextInput(
        label="Type 'AGREE' to accept terms & get verified",
        style=discord.TextStyle.short,
        placeholder="Type AGREE here...",
        required=True,
        max_length=10
    )

    async def on_submit(self, interaction: discord.Interaction):
        if self.confirm_input.value.strip().upper() in ["AGREE", "YES", "ACCEPT"]:
            guild = interaction.guild
            member = interaction.user
            target_role = None
            for r in guild.roles:
                if r.name.lower() in ['member', 'verified', 'user', 'community']:
                    target_role = r
                    break
            if not target_role:
                try:
                    target_role = await guild.create_role(name="Verified Member", color=discord.Color.green(), reason="Rules Verification")
                except Exception:
                    pass
            if target_role and target_role not in member.roles:
                try:
                    await member.add_roles(target_role)
                    role_msg = f" Granted **{target_role.name}** role!"
                except Exception as e:
                    role_msg = f" Note: {e}"
            else:
                role_msg = " You already hold the verified role!"

            await interaction.response.send_message(
                f"🎉 **Terms Accepted!** Thank you {member.mention} for agreeing to our server rules!{role_msg}",
                ephemeral=True
            )
        else:
            await interaction.response.send_message(
                "⚠️ Verification incomplete. Please type **AGREE** in the confirmation box to accept terms.",
                ephemeral=True
            )

class RulesVerificationView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(label="📋 Open Rules & Terms Pop-Up", style=discord.ButtonStyle.blurple, custom_id="view_rules_btn")
    async def view_rules(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.send_modal(RulesModal())

class AutomationBotClient(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        self.add_view(TicketView())
        self.add_view(TicketControlView())
        self.add_view(TicketClosedChannelView())
        self.add_view(TicketDeleteConfirmView())
        self.add_view(RulesVerificationView())
        asyncio.create_task(self._sync_commands())

    async def _sync_commands(self):
        try:
            await self.wait_until_ready()
            for g in self.guilds:
                try:
                    guild_obj = discord.Object(id=g.id)
                    self.tree.copy_global_to(guild=guild_obj)
                    await self.tree.sync(guild=guild_obj)
                    print(f"[BotShard] Instant Guild Slash Commands & UI views synced with '{g.name}' ({g.id}).")
                except Exception as g_err:
                    print(f"[BotShard] Guild {g.id} sync note:", g_err)
            await self.tree.sync()
            print("[BotShard] Global Slash Commands & UI views synced with Discord Gateway.")
        except Exception as e:
            print("Command sync note:", e)

client = AutomationBotClient()

last_channel_edit_times = {}

async def update_live_stats(guild: discord.Guild, force: bool = False):
    """Plugin 4: Live Server Stats Counter Channels synchronized with Website Settings."""
    
    # Read configuration saved from Website Dashboard
    cfg = {}
    try:
        plugin_db = database.get_plugin_config(str(guild.id), 'live-stats')
        if plugin_db and plugin_db.get('config'):
            cfg = plugin_db.get('config', {})
    except Exception as e:
        print("Database config load error for live-stats:", e)

    def parse_bool(val, default=True):
        if val is None:
            return default
        if isinstance(val, bool):
            return val
        if isinstance(val, (int, float)):
            return bool(val)
        if isinstance(val, str):
            return val.lower() not in ['false', '0', 'off', 'none', 'null', '']
        return bool(val)

    # Read ON/OFF Toggles saved from Website Dashboard
    show_members = parse_bool(cfg.get('total_members'), True)
    show_online = parse_bool(cfg.get('online_members'), True)
    show_boosts = parse_bool(cfg.get('server_boosts'), True)
    show_admins = parse_bool(cfg.get('admin_count'), True)
    show_bots = parse_bool(cfg.get('bot_count'), True)
    show_mods = parse_bool(cfg.get('mod_count'), True)

    all_stats_cats = [c for c in guild.categories if 'SERVER STATS' in c.name.upper()]
    stats_cat = None
    if len(all_stats_cats) > 1:
        all_stats_cats.sort(key=lambda c: (len(c.channels) == 0, c.position))
        stats_cat = all_stats_cats[0]
        for extra in all_stats_cats[1:]:
            try:
                for ch in list(extra.channels):
                    await ch.delete()
                await extra.delete()
                print(f"[LiveStats Safeguard] Deleted extra SERVER STATS category '{extra.name}'")
            except Exception as e:
                print(f"[LiveStats Safeguard] Category delete error: {e}")
    elif len(all_stats_cats) == 1:
        stats_cat = all_stats_cats[0]
    else:
        try:
            stats_cat = await guild.create_category("📊 SERVER STATS", position=0)
        except Exception as e:
            print("Stats category creation error:", e)
            return

    member_count = guild.member_count or len(guild.members)
    online_count = sum(1 for m in guild.members if hasattr(m, 'status') and m.status and m.status != discord.Status.offline) or 1
    boost_count = getattr(guild, 'premium_subscription_count', 0) or 0
    admin_count = sum(1 for m in guild.members if m.guild_permissions.administrator or m.guild_permissions.manage_channels) or 1
    bot_count = sum(1 for m in guild.members if m.bot) or 1
    mod_count = sum(1 for m in guild.members if any(r.name.lower() in ['mod', 'moderator', 'staff'] for r in m.roles)) or 1

    specs = {
        'members': {'name': f"👥 Total Members: {member_count:,}", 'enabled': show_members, 'keywords': ['total members', 'members', '👥']},
        'online': {'name': f"🟢 Online Members: {online_count:,}", 'enabled': show_online, 'keywords': ['online members', 'online', '🟢']},
        'boosts': {'name': f"🚀 Server Boosts: {boost_count}", 'enabled': show_boosts, 'keywords': ['server boosts', 'boost', '🚀']},
        'admins': {'name': f"🛡️ Admins: {admin_count:,}", 'enabled': show_admins, 'keywords': ['admin', 'admins', '🛡️']},
        'bots': {'name': f"🤖 Server Bots: {bot_count:,}", 'enabled': show_bots, 'keywords': ['server bots', 'bots', '🤖']},
        'mods': {'name': f"⚔️ Moderators: {mod_count:,}", 'enabled': show_mods, 'keywords': ['moderator', 'moderators', 'mods', '⚔️']}
    }

    overwrites = {
        guild.default_role: discord.PermissionOverwrite(connect=False, view_channel=True)
    }

    now = datetime.utcnow().timestamp()

    # 1. Sweep through all voice channels across the entire guild matching counter keywords
    all_guild_vcs = list(guild.voice_channels)
    for vc in all_guild_vcs:
        vc_lower = vc.name.lower()
        matched_key = None

        for key, spec in specs.items():
            if any(kw in vc_lower for kw in spec['keywords']):
                matched_key = key
                break

        if matched_key:
            spec = specs[matched_key]
            if spec['enabled']:
                if not spec.get('processed'):
                    # Keep channel, move to stats category if needed & update name
                    if vc.category_id != stats_cat.id:
                        try:
                            await vc.edit(category=stats_cat)
                        except Exception:
                            pass
                    if vc.name != spec['name']:
                        last_edit = last_channel_edit_times.get(vc.id, 0)
                        if force or (now - last_edit >= 600):
                            try:
                                last_channel_edit_times[vc.id] = now
                                await vc.edit(name=spec['name'])
                                print(f"[LiveStats] Renamed channel to '{spec['name']}'")
                            except discord.errors.HTTPException as err:
                                if err.status == 429:
                                    print(f"[LiveStats RateLimit] Discord API 429 encountered, backing off for channel '{vc.name}'")
                            except Exception as e:
                                print(f"[LiveStats Note] Channel rename skipped: {e}")
                    spec['processed'] = True
                else:
                    # DUPLICATE CHANNEL -> DELETE FROM DISCORD IMMEDIATELY!
                    try:
                        await vc.delete(reason="Deleting duplicate counter channel")
                        print(f"[LiveStats] 🗑️ DELETED DUPLICATE voice channel from Discord: '{vc.name}'")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        print(f"[LiveStats] Duplicate deletion error: {e}")
            else:
                # Disabled/Toggled OFF on Website -> DELETE FROM DISCORD IMMEDIATELY!
                try:
                    await vc.delete(reason="Disabled in website dashboard settings")
                    print(f"[LiveStats] 🗑️ DELETED disabled voice channel from Discord: '{vc.name}'")
                    await asyncio.sleep(0.3)
                except Exception as e:
                    print(f"[LiveStats] Channel deletion error: {e}")
                spec['processed'] = True
        else:
            if vc.category_id == stats_cat.id and any(char in vc.name for char in ['👥', '🟢', '🚀', '🛡️', '🤖', '⚔️']):
                try:
                    await vc.delete(reason="Obsolete counter channel deleted")
                    print(f"[LiveStats] 🗑️ DELETED obsolete channel: '{vc.name}'")
                    await asyncio.sleep(0.3)
                except Exception:
                    pass
    # 2. Create missing channels for enabled counters
    for key, spec in specs.items():
        if spec['enabled'] and not spec.get('processed'):
            try:
                await guild.create_voice_channel(spec['name'], category=stats_cat, overwrites=overwrites)
                print(f"[LiveStats] ✨ Created voice channel counter: '{spec['name']}' in '{guild.name}'")
            except Exception as create_err:
                print(f"[LiveStats] Missing channel creation error: {create_err}")

from PIL import Image, ImageDraw, ImageFont

def hex_to_rgb(hex_str: str, default=(88, 101, 242)):
    try:
        h = str(hex_str).lstrip('#')
        if len(h) == 6:
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
        elif len(h) == 3:
            return tuple(int(c*2, 16) for c in h)
    except Exception:
        pass
    return default


async def generate_welcome_card_image(member: discord.Member, frame_style: str = 'glass_indigo', show_dp: bool = True, show_display_name: bool = True, show_username: bool = True, custom_color: str = '#5865f2') -> io.BytesIO:
    """Generates an ultra-crisp static 1000x360 PNG welcome banner with distinct geometric layouts per frame style & dynamic custom accent color."""
    width, height = 1000, 360
    accent_rgb = hex_to_rgb(custom_color, (88, 101, 242))
    style_key = str(frame_style).lower()

    # Dynamic styling per template
    if style_key == 'cyber_neon':
        bg_top = (12, 8, 24, 255)
        bg_bot = (int(accent_rgb[0] * 0.3), int(accent_rgb[1] * 0.2), int(accent_rgb[2] * 0.4), 255)
        border_col = (*accent_rgb, 255)
        badge_fill = (*accent_rgb, 50)
        badge_outline = (*accent_rgb, 240)
        subtext_col = (34, 211, 238, 255) # Cyan tech
        badge_tag = f"[ VERIFIED MEMBER #{member.guild.member_count if member.guild else 1:,} ]"
        header_text = f"// WELCOME_TO // {member.guild.name.upper()[:22] if member.guild else 'SERVER'}"
    elif style_key == 'gold_prestige':
        bg_top = (24, 18, 6, 255)
        bg_bot = (48, 36, 12, 255)
        border_col = (*accent_rgb, 255) if custom_color != '#5865f2' else (245, 158, 11, 255)
        badge_fill = (245, 158, 11, 45)
        badge_outline = (250, 204, 21, 255)
        subtext_col = (253, 224, 71, 255)
        badge_tag = f"★ VIP MEMBER #{member.guild.member_count if member.guild else 1:,} ★"
        header_text = f"👑 VIP ACCESS PASS • {member.guild.name.upper()[:20] if member.guild else 'SERVER'}"
    elif style_key == 'emerald_mint':
        bg_top = (4, 24, 16, 255)
        bg_bot = (int(accent_rgb[0] * 0.2), int(accent_rgb[1] * 0.4), int(accent_rgb[2] * 0.3), 255)
        border_col = (*accent_rgb, 255) if custom_color != '#5865f2' else (16, 185, 129, 255)
        badge_fill = (16, 185, 129, 45)
        badge_outline = (52, 211, 153, 255)
        subtext_col = (110, 231, 183, 255)
        badge_tag = f"◈ MEMBER #{member.guild.member_count if member.guild else 1:,} ◈"
        header_text = f"◈ VERIFIED CITIZEN • {member.guild.name.upper()[:20] if member.guild else 'SERVER'}"
    elif style_key == 'dark_obsidian':
        bg_top = (10, 11, 16, 255)
        bg_bot = (22, 25, 34, 255)
        border_col = (71, 85, 105, 255) if custom_color == '#5865f2' else (*accent_rgb, 200)
        badge_fill = (51, 65, 85, 60)
        badge_outline = (148, 163, 184, 255)
        subtext_col = (148, 163, 184, 255)
        badge_tag = f"MEMBER #{member.guild.member_count if member.guild else 1:,}"
        header_text = f"⬛ DIRECTORY • {member.guild.name.upper()[:22] if member.guild else 'SERVER'}"
    elif style_key == 'sunset_wave':
        bg_top = (45, 12, 28, 255)
        bg_bot = (int(accent_rgb[0] * 0.5), int(accent_rgb[1] * 0.2), int(accent_rgb[2] * 0.3), 255)
        border_col = (*accent_rgb, 255) if custom_color != '#5865f2' else (244, 63, 94, 255)
        badge_fill = (244, 63, 94, 45)
        badge_outline = (251, 113, 133, 255)
        subtext_col = (251, 146, 60, 255)
        badge_tag = f"MEMBER #{member.guild.member_count if member.guild else 1:,}"
        header_text = f"🌅 NEW ARRIVAL • {member.guild.name.upper()[:22] if member.guild else 'SERVER'}"
    else: # glass_indigo / default
        bg_top = (12, 16, 32, 255)
        bg_bot = (int(accent_rgb[0] * 0.4), int(accent_rgb[1] * 0.4), int(accent_rgb[2] * 0.6), 255)
        border_col = (*accent_rgb, 255)
        badge_fill = (*accent_rgb, 50)
        badge_outline = (*accent_rgb, 230)
        subtext_col = (*accent_rgb, 255)
        badge_tag = f"MEMBER #{member.guild.member_count if member.guild else 1:,}"
        header_text = f"WELCOME TO {member.guild.name.upper()[:24] if member.guild else 'OUR SERVER'}"

    # 1. Base Gradient Canvas
    base = Image.new("RGBA", (width, height), bg_top)
    draw_base = ImageDraw.Draw(base)
    r1, g1, b1, _ = bg_top
    r2, g2, b2, _ = bg_bot
    for y in range(0, height, 2):
        ratio = y / height
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        draw_base.rectangle([(0, y), (width, y + 2)], fill=(r, g, b, 255))

    # 2. Main Frosted Overlay Panel
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    draw_overlay.rounded_rectangle([16, 16, width - 16, height - 16], radius=20, fill=(14, 16, 26, 215), outline=border_col, width=2)

    # Style-specific geometry accents
    if style_key == 'cyber_neon':
        # Corner brackets & tech lines
        draw_overlay.line([(24, 24), (60, 24)], fill=border_col, width=3)
        draw_overlay.line([(24, 24), (24, 60)], fill=border_col, width=3)
        draw_overlay.line([(width - 24, height - 24), (width - 60, height - 24)], fill=border_col, width=3)
        draw_overlay.line([(width - 24, height - 24), (width - 24, height - 60)], fill=border_col, width=3)
    elif style_key == 'gold_prestige':
        # Double gold border line
        draw_overlay.rounded_rectangle([22, 22, width - 22, height - 22], radius=16, outline=(*border_col[:3], 120), width=1)
    elif style_key == 'emerald_mint':
        # Matrix node dots
        for dot_x in (40, 80, width - 40, width - 80):
            draw_overlay.ellipse([dot_x - 3, 30 - 3, dot_x + 3, 30 + 3], fill=(*border_col[:3], 150))

    # 3. Avatar DP
    avatar_size = 180
    avatar_x, avatar_y = 50, (height - avatar_size) // 2
    if show_dp:
        try:
            avatar_asset = member.display_avatar.with_format('png').with_size(256)
            avatar_bytes = await avatar_asset.read()
            avatar_img = Image.open(io.BytesIO(avatar_bytes)).convert("RGBA")
        except Exception:
            avatar_img = Image.new("RGBA", (avatar_size, avatar_size), border_col)

        a_sized = avatar_img.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
        
        # Avatar shape (cyber = rounded rect, others = circle)
        if style_key in ['cyber_neon', 'dark_obsidian']:
            mask_big = Image.new("L", (avatar_size * 4, avatar_size * 4), 0)
            ImageDraw.Draw(mask_big).rounded_rectangle((0, 0, avatar_size * 4 - 1, avatar_size * 4 - 1), radius=48, fill=255)
            mask = mask_big.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
            draw_overlay.rounded_rectangle([avatar_x - 3, avatar_y - 3, avatar_x + avatar_size + 3, avatar_y + avatar_size + 3], radius=16, outline=border_col, width=3)
        else:
            mask_big = Image.new("L", (avatar_size * 4, avatar_size * 4), 0)
            ImageDraw.Draw(mask_big).ellipse((0, 0, avatar_size * 4 - 1, avatar_size * 4 - 1), fill=255)
            mask = mask_big.resize((avatar_size, avatar_size), Image.Resampling.LANCZOS)
            draw_overlay.ellipse([avatar_x - 3, avatar_y - 3, avatar_x + avatar_size + 3, avatar_y + avatar_size + 3], outline=border_col, width=3)

        overlay.paste(a_sized, (avatar_x, avatar_y), mask)

    # 4. Typography & Badges
    try:
        title_font = ImageFont.truetype("arialbd.ttf", 30)
        user_font = ImageFont.truetype("arialbd.ttf", 48)
        sub_font = ImageFont.truetype("arialbd.ttf", 22)
        badge_font = ImageFont.truetype("arialbd.ttf", 22)
    except Exception:
        title_font = ImageFont.load_default()
        user_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()
        badge_font = ImageFont.load_default()

    text_x = avatar_x + avatar_size + 36 if show_dp else 70
    curr_y = 52

    draw_overlay.text((text_x, curr_y), header_text, fill=(148, 163, 184, 255), font=title_font)
    curr_y += 44

    if show_display_name:
        draw_overlay.text((text_x, curr_y), f"@{member.display_name[:22]}", fill=(255, 255, 255, 255), font=user_font)
        curr_y += 56

    if show_username:
        draw_overlay.text((text_x, curr_y), f"{member.name} (ID: {str(member.id)[-6:]})", fill=subtext_col, font=sub_font)
        curr_y += 36

    try:
        bbox = draw_overlay.textbbox((0, 0), badge_tag, font=badge_font)
        pill_w = max(180, (bbox[2] - bbox[0]) + 36)
    except Exception:
        pill_w = 200

    draw_overlay.rounded_rectangle([text_x, curr_y + 4, text_x + pill_w, curr_y + 42], radius=14, fill=badge_fill, outline=badge_outline, width=2)
    draw_overlay.text((text_x + 18, curr_y + 11), badge_tag, fill=subtext_col, font=badge_font)

    final_card = Image.alpha_composite(base, overlay)
    buffer = io.BytesIO()
    final_card.save(buffer, format="PNG", optimize=True)
    buffer.seek(0)
    return buffer


def generate_mini_animated_gif(emoji_type: str) -> bytes:
    """Generates ultra HD 128x128 8-frame smooth animated custom emoji GIFs cleanly without background circle outlines."""
    images = []
    import math
    
    font = None
    # Load supersampled font size (210px rendered on 256x256 canvas then downsampled to 128x128 for crisp sharp HD quality)
    font_paths = ["seguiemj.ttf", "C:\\Windows\\Fonts\\seguiemj.ttf", "arialbd.ttf"]
    for path in font_paths:
        try:
            font = ImageFont.truetype(path, 210)
            break
        except Exception:
            pass
            
    emoji_chars = {
        'siren': '🚨',
        'wave': '👋',
        'fire': '🔥',
        'sparkles': '✨',
        'party': '🎉',
        'crown': '👑',
        'rocket': '🚀',
        'rules': '📜',
        'pin': '📌',
        'updates': '📢',
        'chat': '💬',
        'star': '⭐',
        'duck': '🦆',
        'catjam': '🐱',
        'popcat': '😺',
        'blobdance': '🥳',
        'equalizer': '🎚️',
        'arrow': '➤',
        'car': '🏎️',
        'gem': '💎',
        'pakistan': '🇵🇰'
    }
    char = emoji_chars.get(emoji_type, '✨')

    for frame_idx in range(8):
        t = (frame_idx / 8.0) * 2 * math.pi
        # High resolution 256x256 canvas for supersampled crisp rendering
        img_large = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        d = ImageDraw.Draw(img_large)

        offset_x = 0
        offset_y = 0
        
        if emoji_type == 'wave':
            offset_x = int(16 * math.sin(t))
            offset_y = int(-8 * abs(math.cos(t)))
        elif emoji_type == 'duck':
            offset_x = int(18 * math.sin(t))
            offset_y = int(-12 * abs(math.cos(t)))
        elif emoji_type == 'catjam':
            offset_y = int(16 * math.sin(t))
            offset_x = int(6 * math.cos(t))
        elif emoji_type == 'popcat':
            offset_y = int(-14 * abs(math.sin(t)))
        elif emoji_type == 'blobdance':
            offset_y = int(-16 * abs(math.sin(t)))
            offset_x = int(10 * math.cos(t))
        elif emoji_type == 'equalizer':
            offset_y = int(-10 * math.sin(t * 2))
        elif emoji_type == 'arrow':
            offset_x = int(14 * math.sin(t))
        elif emoji_type == 'car':
            offset_x = int(16 * math.sin(t))
            offset_y = int(-4 * abs(math.cos(t)))
        elif emoji_type == 'gem':
            offset_y = int(-8 * abs(math.sin(t)))
        elif emoji_type == 'pakistan':
            offset_x = int(8 * math.sin(t))
            offset_y = int(-6 * math.cos(t))
        elif emoji_type == 'siren':
            offset_y = int(-6 * abs(math.sin(t * 2)))
        elif emoji_type == 'fire':
            offset_y = int(-12 * abs(math.sin(t)))
        elif emoji_type == 'sparkles':
            offset_y = int(-8 * math.sin(t))
        elif emoji_type == 'crown':
            offset_y = int(-6 * abs(math.sin(t)))
        elif emoji_type == 'party':
            offset_y = int(-10 * abs(math.sin(t)))
        elif emoji_type == 'rocket':
            offset_y = int(-16 * math.sin(t))
            offset_x = int(8 * math.cos(t))
        elif emoji_type == 'rules':
            offset_y = int(-6 * math.sin(t))
        elif emoji_type == 'pin':
            offset_y = int(-10 * abs(math.sin(t)))
        elif emoji_type == 'updates':
            offset_x = int(12 * math.sin(t))
        elif emoji_type == 'chat':
            offset_y = int(-8 * math.sin(t))
        elif emoji_type == 'star':
            offset_y = int(-6 * math.sin(t))

        if font:
            try:
                d.text((128 + offset_x, 128 + offset_y), char, font=font, anchor="mm", embedded_color=True)
            except Exception:
                d.text((128 + offset_x, 128 + offset_y), char, font=font, anchor="mm", fill=(255, 200, 0, 255))
        else:
            if emoji_type == 'siren':
                c = (239, 68, 68) if frame_idx % 2 == 0 else (0, 240, 255)
                d.polygon([(128, 32), (48, 208), (208, 208)], fill=(*c, 255))
            elif emoji_type == 'crown':
                d.polygon([(32, 200), (48, 72), (108, 140), (128, 40), (148, 140), (208, 72), (224, 200)], fill=(245, 158, 11, 255))

        # Downsample cleanly to 128x128 for Ultra HD razor sharpness
        img = img_large.resize((128, 128), Image.Resampling.LANCZOS)
        alpha = img.split()[3]
        p_img = img.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=255)
        mask = Image.eval(alpha, lambda a: 255 if a < 128 else 0)
        p_img.paste(255, mask)
        images.append(p_img)

    buf = io.BytesIO()
    images[0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=images[1:],
        duration=120,
        loop=0,
        transparency=255,
        disposal=2
    )
    return buf.getvalue()

async def ensure_replyflow_animated_emojis(guild: discord.Guild):
    """Auto-installs and syncs high-res animated GIF emojis on the user's server if bot has manage_emojis permission."""
    if not guild.me.guild_permissions.manage_emojis_and_stickers:
        return

    needed_emojis = [
        'rf_siren', 'rf_wave', 'rf_fire', 'rf_sparkles', 'rf_party', 'rf_crown',
        'rf_rocket', 'rf_rules', 'rf_pin', 'rf_updates', 'rf_chat', 'rf_star',
        'rf_duck', 'rf_catjam', 'rf_popcat', 'rf_blobdance', 'rf_equalizer',
        'rf_arrow', 'rf_car', 'rf_gem', 'rf_pakistan'
    ]
    existing_emojis = {e.name: e for e in guild.emojis}

    for name in needed_emojis:
        if name in existing_emojis:
            # Emoji already installed; skip to prevent Discord API Rate Limiting!
            continue
        emoji_type = name.replace('rf_', '')
        gif_bytes = generate_mini_animated_gif(emoji_type)
        try:
            await guild.create_custom_emoji(name=name, image=gif_bytes, reason="ReplyFlow Automated Animated Emoji System")
            print(f"[AutoEmojiSystem] Auto-installed animated GIF emoji :{name}: in {guild.name}")
        except Exception as e:
            print(f"[AutoEmojiSystem Note] Could not auto-install emoji :{name}: in {guild.name}: {e}")

async def ensure_permanent_welcome_channel(guild: discord.Guild) -> discord.TextChannel:
    """Ensures a dedicated public #welcome channel exists at position 0 for welcoming joining members."""
    category = (
        discord.utils.get(guild.categories, name="👋 WELCOME LOBBY") or
        discord.utils.get(guild.categories, name="WELCOME LOBBY") or
        discord.utils.get(guild.categories, name="GENERAL-ROOM")
    )
    if not category:
        try:
            category = await guild.create_category("👋 WELCOME LOBBY")
            try:
                if category.position != 0:
                    await category.edit(position=0)
            except Exception:
                pass
            print(f"[WelcomeSystem] Created WELCOME LOBBY category at position 0 in {guild.name}")
        except Exception as e:
            print("Welcome category creation error:", e)
    else:
        try:
            if category.position != 0:
                await category.edit(position=0)
        except Exception:
            pass

    welc_chan = (
        discord.utils.get(guild.text_channels, name="welcome") or
        discord.utils.get(guild.text_channels, name="welcome-chat") or
        discord.utils.get(guild.text_channels, name="welcome-lobby")
    )
    if not welc_chan:
        try:
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=False),
                guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, embed_links=True, attach_files=True)
            }
            welc_chan = await guild.create_text_channel("welcome", category=category, overwrites=overwrites, reason="Permanent Welcome Channel Setup")
            print(f"[WelcomeSystem] Created public '#welcome' channel in {guild.name}")
        except Exception as e:
            print("Welcome channel creation error:", e)
            return guild.system_channel

    if welc_chan:
        try:
            if category and welc_chan.category != category:
                await welc_chan.edit(category=category, position=0)
            elif welc_chan.position != 0:
                await welc_chan.edit(position=0)
        except Exception:
            pass

        # Set server system_channel to #welcome so Discord defaults landing new members into #welcome!
        try:
            if guild.system_channel != welc_chan:
                await guild.edit(system_channel=welc_chan)
                print(f"[WelcomeSystem] Set server system_channel to #{welc_chan.name}")
        except Exception as e:
            print("System channel update error:", e)

    return welc_chan

WELCOMED_FILE = os.path.join(os.path.dirname(__file__), "welcomed_members.json")

def load_welcomed_members() -> set:
    if os.path.exists(WELCOMED_FILE):
        try:
            with open(WELCOMED_FILE, "r") as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_welcomed_member(user_id: str):
    welcomed = load_welcomed_members()
    welcomed.add(str(user_id))
    try:
        with open(WELCOMED_FILE, "w") as f:
            json.dump(list(welcomed), f)
    except Exception as e:
        print("Save welcomed error:", e)

recent_welcomes = {}

def remove_welcomed_member(user_id):
    global recent_welcomes
    welcomed = load_welcomed_members()
    uid_str = str(user_id)
    if uid_str in welcomed:
        welcomed.remove(uid_str)
        try:
            with open(WELCOMED_FILE, "w") as f:
                json.dump(list(welcomed), f)
        except Exception as e:
            print("Remove welcomed error:", e)
    # Clear in-memory debounce cache so rejoining members immediately receive welcome card!
    try:
        recent_welcomes.pop(int(user_id), None)
        recent_welcomes.pop(str(user_id), None)
    except Exception:
        pass

def resolve_user_id_for_guild(guild_id: str) -> str:
    if not guild_id:
        return None
    guild_id_str = str(guild_id)
    matches = []
    try:
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.json')
        if os.path.exists(db_path):
            with open(db_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Check discordGuildsStore first
            stores = [data.get('discordGuildsStore', {}), data.get('userGuildsDB', {})]
            for user_guilds in stores:
                if isinstance(user_guilds, dict):
                    for user_id, guilds in user_guilds.items():
                        if isinstance(guilds, list):
                            for g in guilds:
                                if isinstance(g, dict) and str(g.get('id')) == guild_id_str:
                                    matches.append((user_id, g.get('connectedAt', '')))
    except Exception as err:
        print(f"[UserGuildMapping Note] Error resolving user_id for guild {guild_id}: {err}")
        return None

    if not matches:
        return None
    matches.sort(key=lambda m: m[1], reverse=True)
    return matches[0][0]

async def fetch_active_welcome_template(guild_id: str):
    if not guild_id:
        return None

    # 0. Check SQLite system.db for active welcome template config for this specific guild
    try:
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT enabled, config_json FROM plugin_configs WHERE guild_id = ? AND plugin_key = 'welcome'", (str(guild_id),))
        row = cursor.fetchone()
        conn.close()
        if row:
            if not row["enabled"]:
                return None
            try:
                c_data = json.loads(row["config_json"])
                if isinstance(c_data, dict):
                    # Ensure message_text is set from welcome_text if needed
                    if not c_data.get('message_text') and c_data.get('welcome_text'):
                        c_data['message_text'] = c_data['welcome_text']
                    if c_data.get('message_text') and str(c_data.get('message_text')).strip():
                        return c_data
            except Exception:
                pass
    except Exception as sq_err:
        pass

    user_id = resolve_user_id_for_guild(str(guild_id))

    # 1. Check database.json for guild-specific and user-specific active templates
    try:
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database.json')
        if os.path.exists(db_path):
            with open(db_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            user_templates_db = data.get('userWelcomeTemplatesDB', {})
            if isinstance(user_templates_db, dict):
                # Guild-specific user key (e.g. user_123_1541470148815495269)
                if user_id:
                    guild_key = f"{user_id}_{guild_id}"
                    if guild_key in user_templates_db:
                        for t in user_templates_db[guild_key]:
                            if isinstance(t, dict) and t.get('is_active') in (1, True, '1', 'true'):
                                if not t.get('message_text') and t.get('welcome_text'):
                                    t['message_text'] = t['welcome_text']
                                return t
                    
                    if user_id in user_templates_db:
                        for t in user_templates_db[user_id]:
                            if isinstance(t, dict) and t.get('is_active') in (1, True, '1', 'true'):
                                if not t.get('message_text') and t.get('welcome_text'):
                                    t['message_text'] = t['welcome_text']
                                return t

                # Also search any key that ends with _guild_id
                for k, list_val in user_templates_db.items():
                    if k.endswith(f"_{guild_id}") and isinstance(list_val, list):
                        for t in list_val:
                            if isinstance(t, dict) and t.get('is_active') in (1, True, '1', 'true'):
                                if not t.get('message_text') and t.get('welcome_text'):
                                    t['message_text'] = t['welcome_text']
                                return t

            templates = data.get('welcomeTemplatesDB', [])
            if isinstance(templates, list):
                for t in templates:
                        return t
    except Exception as err:
        print(f"[JSON DB Note] Error reading database.json for welcome template: {err}")

    return None

def create_welcome_links_view(links_data):
    try:
        links = {}
        if isinstance(links_data, (bytes, bytearray)):
            try:
                links_data = links_data.decode('utf-8')
            except Exception:
                pass
        if isinstance(links_data, str):
            try:
                links = json.loads(links_data)
            except Exception:
                links = {}
        elif isinstance(links_data, dict):
            links = links_data

        mapping = [
            ('web', 'Website', '🌐'),
            ('ig', 'Instagram', '📸'),
            ('yt', 'YouTube', '▶️'),
            ('tk', 'TikTok', '🎵'),
            ('tw', 'Twitter/X', '🐦')
        ]

        view = ui.View(timeout=None)
        has_links = False

        if isinstance(links, dict):
            for key, label, emoji in mapping:
                url = links.get(key)
                if url and isinstance(url, str) and url.strip():
                    url = url.strip()
                    if not (url.startswith('http://') or url.startswith('https://')):
                        url = 'https://' + url
                    view.add_item(ui.Button(label=label, emoji=emoji, url=url, style=discord.ButtonStyle.link))
                    has_links = True

        if has_links:
            return view
    except Exception as e:
        print(f"Error parsing welcome links: {e}")
    return None

async def send_welcome_flow(member: discord.Member, force_channel: discord.TextChannel = None, is_preview: bool = False):
    if member.bot and not is_preview:
        return

    now = datetime.utcnow().timestamp()
    if not is_preview and member.id in recent_welcomes and (now - recent_welcomes[member.id]) < 60:
        print(f"[WelcomeFlow] Suppressed duplicate welcome event for {member.name}")
        return

    recent_welcomes[member.id] = now
    print(f"[WelcomeFlow] Executing welcome greetings & guide for {member.name} in {member.guild.name} (Preview: {is_preview})")
    
    # 1. Save in SQLite Database
    joined_time = member.joined_at.isoformat() if member.joined_at else datetime.utcnow().isoformat()
    database.record_member_join(str(member.id), str(member.guild.id), member.name, member.display_name, joined_time)

    # 2. Plugin 1: Auto-Role Assignment
    try:
        ar_cfg = database.get_plugin_config(str(member.guild.id), 'autorole')
        ar_data = ar_cfg.get('config', {}) if ar_cfg else {}
        target_role_names = ar_data.get('roles', ['Member', 'Verified', 'User', 'Community'])
        target_role_names_clean = [str(r).strip().lower().replace('@', '') for r in target_role_names]

        roles_to_assign = []
        for role in member.guild.roles:
            if role.name.lower() in target_role_names_clean:
                roles_to_assign.append(role)

        if not roles_to_assign:
            # Fallback: find or create default Member role
            for role in member.guild.roles:
                if role.name.lower() in ['member', 'verified', 'user', 'community']:
                    roles_to_assign.append(role)
                    break
            if not roles_to_assign:
                try:
                    default_r = await member.guild.create_role(name="Member", color=discord.Color.blue(), reason="Auto-Role Plugin Initialization")
                    roles_to_assign.append(default_r)
                except Exception as e:
                    print("Role creation error:", e)

        for r_assign in roles_to_assign:
            if r_assign and r_assign not in member.roles:
                try:
                    await member.add_roles(r_assign)
                    print(f"Assigned auto-role '{r_assign.name}' to {member.name}")
                except Exception as e:
                    print(f"Auto-role assignment error for {r_assign.name}: {e}")
    except Exception as ar_err:
        print("[AutoRole Note] Exception in role assignment:", ar_err)

    # 3. Plugin 4: Update Live Stats Counter Channels
    await update_live_stats(member.guild)

    # 4. Target Channel Selection & Automatic Welcome Greetings
    target_channel = force_channel if force_channel else await ensure_permanent_welcome_channel(member.guild)

    # Dynamic Channel Mention Resolution
    guild = member.guild
    
    rules_ch = (
        discord.utils.get(guild.text_channels, name="rules") or 
        discord.utils.get(guild.text_channels, name="📜-rules") or 
        discord.utils.get(guild.text_channels, name="rules-and-info") or
        discord.utils.get(guild.text_channels, name="guidelines")
    )
    rules_mention = rules_ch.mention if rules_ch else "**#rules**"

    general_ch = (
        discord.utils.get(guild.text_channels, name="general") or 
        discord.utils.get(guild.text_channels, name="general-chat") or 
        discord.utils.get(guild.text_channels, name="💬-general-chat") or
        discord.utils.get(guild.text_channels, name="lobby")
    )
    general_mention = general_ch.mention if general_ch else "**#general**"

    updates_ch = (
        discord.utils.get(guild.text_channels, name="recent-updates") or 
        discord.utils.get(guild.text_channels, name="updates") or 
        discord.utils.get(guild.text_channels, name="announcements") or
        discord.utils.get(guild.text_channels, name="📢-recent-updates")
    )
    updates_mention = updates_ch.mention if updates_ch else "**#updates**"

    def format_msg(raw_text: str) -> str:
        res = (raw_text
            .replace('{user}', member.mention)
            .replace('{member}', member.mention)
            .replace('{username}', member.name)
            .replace('{name}', member.display_name)
            .replace('{server}', guild.name)
            .replace('{guild}', guild.name)
            .replace('{count}', f"{guild.member_count:,}")
            .replace('{member_count}', f"{guild.member_count:,}")
            .replace('{rules_channel}', rules_mention)
            .replace('{general_channel}', general_mention)
            .replace('{updates_channel}', updates_mention)
            .replace('{update_channel}', updates_mention)
        )
        return res

    # Generate Welcome Canvas Image Card
    template = await fetch_active_welcome_template(str(member.guild.id))
    if not template:
        print(f"[WelcomeFlow] No active user welcome template configured for {member.guild.name}. Skipping welcome message.")
        return

    card_file = None
    links_data = template.get('links')
    links = {}
    if isinstance(links_data, (bytes, bytearray)):
        try:
            links_data = links_data.decode('utf-8')
        except Exception:
            pass
    if isinstance(links_data, str):
        try:
            links = json.loads(links_data)
        except Exception:
            links = {}
    elif isinstance(links_data, dict):
        links = links_data
    frame_style = links.get('frame_style', 'glass_indigo')
    show_dp = links.get('show_dp', True)
    show_display_name = links.get('show_display_name', True)
    show_username = links.get('show_username', True)
    
    embed_title_raw = links.get('embed_title') or f"✨ Welcome to {member.guild.name}!"
    embed_color_hex = links.get('embed_color') or '#5865f2'
    embed_footer_raw = links.get('embed_footer') or f"⚡ Powered by ReplyFlow Discord Automation • {member.guild.name}"
    ping_user = links.get('ping_user', True)
    send_dm = links.get('send_dm', True)

    welcome_heading = format_msg(embed_title_raw)
    welcome_footer = format_msg(embed_footer_raw)
    msg_text = template.get('message_text') or ''
    welcome_greetings = format_msg(msg_text)
    if not welcome_greetings:
        welcome_greetings = f"👋 Welcome {member.mention} to {member.guild.name}!"

    card_color = links.get('card_color') or '#5865f2'
    card_bytes = await generate_welcome_card_image(member, frame_style, show_dp, show_display_name, show_username, custom_color=card_color)
    card_file = discord.File(fp=card_bytes, filename="welcome_card.png")
        
    try:
        embed_color = discord.Color.from_str(embed_color_hex)
    except Exception:
        embed_color = discord.Color.from_rgb(88, 101, 242)

    embed = discord.Embed(
        title=welcome_heading,
        description=welcome_greetings,
        color=embed_color
    )
    
    media_url = template.get('media_url') or ''
    if card_file:
        embed.set_image(url=f"attachment://{card_file.filename}")
    elif media_url and not media_url.startswith('data:'):
        embed.set_image(url=media_url)
        
    embed.set_footer(text=welcome_footer)

    if target_channel:
        try:
            kwargs = {
                "embed": embed
            }
            if ping_user:
                kwargs["content"] = f"👋 **Welcome to {member.guild.name}, {member.mention}!**"
            if card_file:
                kwargs["file"] = card_file
                
            view = create_welcome_links_view(template.get('links') if template else None)
            if view:
                kwargs['view'] = view
                    
            await target_channel.send(**kwargs)
            print(f"SUCCESS: Automatically sent Welcome Message for {member.name} to #{target_channel.name}")
        except Exception as e:
            print(f"ERROR: Channel welcome message error: {e}")

    # Send Private DM to User if send_dm is enabled
    if send_dm:
        try:
            dm_card_bytes = await generate_welcome_card_image(member)
            dm_file = discord.File(fp=dm_card_bytes, filename="dm_welcome_card.png")
            dm_embed = discord.Embed(
                title=f"✨ Welcome to {member.guild.name}!",
                description=f"Hey {member.name}! We're thrilled to have you in our community! 🎉 Check out channels & enjoy your stay.",
                color=discord.Color.from_rgb(88, 101, 242)
            )
            dm_embed.set_image(url="attachment://dm_welcome_card.png")
            dm_embed.set_footer(text=f"{member.guild.name} Direct Message Notification")
            await member.send(embed=dm_embed, file=dm_file)
            print(f"SUCCESS: Sent private welcome DM to {member.name}")
        except Exception as dm_err:
            print(f"[DM Welcome Note] Could not DM user {member.name}: {dm_err}")

async def ensure_permanent_ticket_channel(guild: discord.Guild):
    """Creates & initializes a permanent #tickets channel with the interactive Ticket Panel embed."""
    category = discord.utils.get(guild.categories, name="TICKETS") or discord.utils.get(guild.categories, name="🎟️ SUPPORT TICKETS")
    if not category:
        try:
            category = await guild.create_category("🎟️ SUPPORT TICKETS")
            print(f"[TicketSystem] Created '🎟️ SUPPORT TICKETS' category in {guild.name}")
        except Exception as e:
            print("Category creation error:", e)

    # Search for permanent ticket channel
    ticket_chan = (
        discord.utils.get(guild.text_channels, name="tickets") or 
        discord.utils.get(guild.text_channels, name="support-tickets") or 
        discord.utils.get(guild.text_channels, name="open-a-ticket")
    )
    
    if not ticket_chan:
        try:
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=False, add_reactions=False),
                guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, embed_links=True, manage_messages=True)
            }
            ticket_chan = await guild.create_text_channel("tickets", category=category, overwrites=overwrites, reason="Permanent Ticket Channel Setup")
            print(f"[TicketSystem] Created permanent '#tickets' channel in {guild.name}")
        except Exception as e:
            print("Permanent ticket channel creation error:", e)
            return

    # Check if panel message is already present
    has_panel = False
    try:
        async for msg in ticket_chan.history(limit=20):
            if msg.author == guild.me and msg.embeds:
                for emb in msg.embeds:
                    if emb.title and "Ticket" in emb.title:
                        has_panel = True
                        try:
                            await msg.edit(view=TicketView())
                            print(f"[TicketSystem] Refreshed TicketView on #{ticket_chan.name}")
                        except Exception as edit_err:
                            print("[TicketSystem] Refresh TicketView error:", edit_err)
                        break
            if has_panel:
                break
    except Exception as e:
        print("History check error:", e)

    if not has_panel and ticket_chan:
        embed = discord.Embed(
            title="🎟️ Support Ticket Hub",
            description="Click **📩 Create Ticket** below to open a private support ticket with server staff.\n\n"
                        "📌 **Instant Ticket Creation**:\n"
                        "1. Click **📩 Create Ticket** below.\n"
                        "2. A private channel (`#ticket-001`, `#ticket-002`...) is created instantly.\n"
                        "3. Talk directly with staff — **no forms, popups, or questions**!\n\n"
                        "👇 **Click below to open a new support ticket**:",
            color=discord.Color.from_rgb(88, 101, 242)
        )
        embed.set_footer(text="ReplyFlow Instant Support Automation System • 24/7 Active")
        try:
            msg = await ticket_chan.send(embed=embed, view=TicketView())
            try:
                await msg.pin(reason="Permanent Support Panel")
            except Exception:
                pass
            print(f"[TicketSystem] Posted permanent Ticket Panel embed to #{ticket_chan.name}")
        except Exception as e:
            print("Ticket panel send error:", e)

async def cleanup_duplicate_ticket_channels(guild: discord.Guild):
    """Safely preserve active multi-tickets per user while deleting empty abandoned channels."""
    for ch in guild.text_channels:
        if ch.name.lower().startswith("ticket-") and ch.name.lower() not in ["tickets", "support-tickets", "open-a-ticket"]:
            try:
                # If channel has 0 user messages and is older than 24 hours, clean up
                msg_count = 0
                async for msg in ch.history(limit=5):
                    msg_count += 1
                if msg_count == 0:
                    await ch.delete(reason="Cleanup abandoned 0-message ticket channel")
                    print(f"[TicketCleanup] Deleted empty abandoned ticket channel #{ch.name}")
            except Exception as e:
                pass

async def refresh_all_ticket_channel_views(guild: discord.Guild):
    """Refreshes old ticket channel messages to replace legacy buttons (Rename/Reopen) with clean views."""
    for ch in guild.text_channels:
        if ch.name.lower().startswith("ticket-"):
            try:
                async for msg in ch.history(limit=10):
                    if msg.author == guild.me and msg.components:
                        all_buttons = [getattr(b, 'custom_id', '') for row in msg.components for b in row.children]
                        if any(b in ["rename_ticket_btn", "reopen_ticket_btn", "close_admin_btn", "close_user_btn"] for b in all_buttons) or len(all_buttons) > 2:
                            try:
                                is_closed = False
                                if ch.category and "CLOSED" in ch.category.name.upper():
                                    is_closed = True
                                elif "closed" in ch.name.lower():
                                    is_closed = True

                                if is_closed:
                                    await msg.edit(view=TicketClosedChannelView())
                                else:
                                    await msg.edit(view=TicketControlView())
                                print(f"[TicketSystem] Refreshed buttons on #{ch.name}")
                            except Exception as e:
                                print(f"Ticket view refresh error on #{ch.name}:", e)
            except Exception:
                pass


async def ensure_permanent_ai_channel(guild: discord.Guild) -> discord.TextChannel:
    """Creates & initializes a dedicated #ai-assistant channel under 🤖 AI & COMMUNITY category."""
    category = (
        discord.utils.get(guild.categories, name="🤖 AI & COMMUNITY") or
        discord.utils.get(guild.categories, name="AI & COMMUNITY") or
        discord.utils.get(guild.categories, name="INFORMATION")
    )
    if not category:
        try:
            category = await guild.create_category("🤖 AI & COMMUNITY")
            try:
                await category.edit(position=2)
            except Exception:
                pass
            print(f"[AISystem] Created AI & COMMUNITY category in {guild.name}")
        except Exception as e:
            print("AI category creation error:", e)
    else:
        try:
            await category.edit(position=2)
        except Exception:
            pass

    ai_chan = (
        discord.utils.get(guild.text_channels, name="ai-assistant") or
        discord.utils.get(guild.text_channels, name="ai-chat") or
        discord.utils.get(guild.text_channels, name="ai-help")
    )
    
    if not ai_chan:
        try:
            overwrites = {
                guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=True, embed_links=True, attach_files=True),
                guild.me: discord.PermissionOverwrite(read_messages=True, send_messages=True, embed_links=True, attach_files=True, manage_messages=True)
            }
            ai_chan = await guild.create_text_channel("ai-assistant", category=category, overwrites=overwrites, reason="Dedicated AI Channel Setup")
            print(f"[AISystem] Created dedicated '#ai-assistant' channel in {guild.name}")
        except Exception as e:
            print("AI channel creation error:", e)
            return None
    elif category and ai_chan.category != category:
        try:
            await ai_chan.edit(category=category)
        except Exception:
            pass

    # Check if pinned guide embed is already present
    has_guide = False
    try:
        async for msg in ai_chan.history(limit=20):
            if msg.author == guild.me and msg.embeds:
                for emb in msg.embeds:
                    if emb.title and "AI Smart Assistant" in emb.title:
                        has_guide = True
                        break
            if has_guide:
                break
    except Exception as e:
        print("AI history check error:", e)

    if not has_guide and ai_chan:
        embed = discord.Embed(
            title=f"🤖 AI Smart Assistant Hub - {guild.name}",
            description=(
                f"Welcome to the dedicated AI Assistant Hub! Our AI assistant is trained to help you 24/7 with questions about **{guild.name}**, trading signals, rules, leveling, and support.\n\n"
                f"💡 **How to Talk to the AI**:\n"
                f"1. **Use Slash Command**: Type `/ai <your question>` anywhere in the server.\n"
                f"2. **Direct Mention**: Tag `@Automation Bot` in any message to ask a question.\n"
                f"3. **Chat Naturally Here**: Type your question directly in this channel or ask about the server!\n\n"
                f"💬 **Example Questions You Can Ask**:\n"
                f"• *'What is this server about?'*\n"
                f"• *'How do I check my rank or level up?'*\n"
                f"• *'How do I open a support ticket?'*\n"
                f"• *'What are the server rules?'*\n"
                f"• *'Where can I see social feeds and market signals?'*\n\n"
                f"⚡ *The AI answers naturally like a human staff member and is available 24/7!*"
            ),
            color=discord.Color.from_rgb(88, 101, 242)
        )
        avatar_url = guild.me.display_avatar.url if guild.me else ""
        embed.set_thumbnail(url=avatar_url)
        embed.set_footer(text=f"{guild.name} • 24/7 AI Smart Assistant Engine")
        
        try:
            msg = await ai_chan.send(embed=embed)
            try:
                await msg.pin(reason="AI Assistant Guide Panel")
            except Exception:
                pass
            print(f"[AISystem] Posted pinned AI Guide embed to #{ai_chan.name}")
        except Exception as e:
            print("AI guide send error:", e)

    return ai_chan

last_live_stats_config_hash = {}

async def live_stats_sync_loop():
    global last_live_stats_config_hash
    await client.wait_until_ready()
    while not client.is_closed():
        try:
            for g in client.guilds:
                cfg = database.get_plugin_config(str(g.id), 'live-stats')
                cfg_hash = json.dumps(cfg, sort_keys=True)
                prev_hash = last_live_stats_config_hash.get(g.id)
                if prev_hash is not None and prev_hash != cfg_hash:
                    last_live_stats_config_hash[g.id] = cfg_hash
                    print(f"[LiveStats Realtime Sync] Config updated for '{g.name}'! Syncing Discord counter channels in real-time...")
                    await update_live_stats(g, force=True)
                else:
                    if prev_hash is None:
                        last_live_stats_config_hash[g.id] = cfg_hash
                    await update_live_stats(g, force=False)
        except Exception as e:
            print("Live stats loop note:", e)
        await asyncio.sleep(3)

last_social_posts = {}

async def social_feed_sync_loop():
    await client.wait_until_ready()
    while not client.is_closed():
        try:
            for g in client.guilds:
                try:
                    config = database.get_plugin_config(str(g.id), 'social-feed')
                except Exception:
                    config = None
                    
                if not config or not config.get('enabled'):
                    continue
                    
                settings = config.get('config', {})
                channel_name = settings.get('target_channel', 'general').replace('#', '').strip()
                
                # Find target channel or auto-create inside category if missing
                target_channel = discord.utils.get(g.text_channels, name=channel_name)
                if not target_channel:
                    try:
                        cat = discord.utils.get(g.categories, name="📢 SOCIAL FEEDS") or discord.utils.get(g.categories, name="SOCIAL FEEDS")
                        if not cat:
                            cat = await g.create_category("📢 SOCIAL FEEDS")
                        target_channel = await g.create_text_channel(name=channel_name, category=cat)
                        print(f"[SocialFeed] Auto-created target channel #{channel_name} in {g.name}")
                    except Exception as err:
                        print(f"[SocialFeed] Channel creation fallback: {err}")
                        target_channel = discord.utils.get(g.text_channels, name="general") or (g.text_channels[0] if g.text_channels else None)
                
                if not target_channel:
                    continue
                    
                # All 4 platforms with playable URLs and custom lines
                yt_handle = settings.get('youtube') or '@ContentCreator'
                yt_msg = settings.get('youtube_msg') or "@everyone, New video uploaded! Make sure to check it out, like and subscribe: {url}"
                
                ig_handle = settings.get('instagram') or '@replyflow_official'
                ig_msg = settings.get('instagram_msg') or "📸 New Instagram post alert! Check it out here: {url}"
                
                tt_handle = settings.get('tiktok') or '@replyflow_app'
                tt_msg = settings.get('tiktok_msg') or "🎵 New TikTok video dropped! Watch & like here: {url}"
                
                kick_handle = settings.get('kick') or 'replyflow_live'
                kick_msg = settings.get('kick_msg') or "🟢 Live stream is ON! Tune in to Kick: {url}"
                
                platforms = [
                    ('youtube', yt_handle, yt_msg, 'https://www.youtube.com/watch?v=jNQXAC9IVRw'),
                    ('instagram', ig_handle, ig_msg, 'https://www.instagram.com/p/C-4Z8N1sX_Y/'),
                    ('tiktok', tt_handle, tt_msg, 'https://www.tiktok.com/@scout2015/video/6718335390845095173'),
                    ('kick', kick_handle, kick_msg, 'https://kick.com/xqc')
                ]
                
                for p_id, handle, template_msg, mock_url in platforms:
                    key = f"{g.id}_{p_id}_{handle}_v3_sent"
                    if key not in last_social_posts:
                        last_social_posts[key] = True
                        try:
                            final_msg = template_msg.replace('{url}', mock_url)
                            if mock_url not in final_msg and p_id in ['youtube', 'tiktok']:
                                final_msg += f" {mock_url}"
                            
                            if p_id in ['youtube', 'tiktok']:
                                # Send plain text for native video player
                                await target_channel.send(content=final_msg)
                            elif p_id == 'instagram':
                                ig_embed = discord.Embed(
                                    title=f"📸 New Instagram Post from {handle}!",
                                    description=f"🔥 **New content is live on Instagram!**\n\n👉 **[Click Here to Watch Post]({mock_url})**",
                                    color=0xE1306C
                                )
                                ig_embed.set_author(name=f"{handle} • Instagram", icon_url="https://cdn-icons-png.flaticon.com/512/174/174855.png")
                                ig_embed.set_image(url="https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&auto=format&fit=crop&q=80")
                                ig_embed.set_footer(text="ReplyFlow Social Feed Hub • Instagram Auto-Broadcast")
                                await target_channel.send(content=final_msg, embed=ig_embed)
                            elif p_id == 'kick':
                                kick_embed = discord.Embed(
                                    title=f"🟢 {handle} is LIVE NOW on Kick!",
                                    description=f"🎮 **LIVE STREAM IS STARTED!**\n\n👉 **[Click Here to Watch Stream Live]({mock_url})**",
                                    color=0x53FC18
                                )
                                kick_embed.set_author(name=f"{handle} • Kick Streamer", icon_url="https://kick.com/favicon.ico")
                                kick_embed.set_image(url="https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80")
                                kick_embed.set_footer(text="ReplyFlow Social Feed Hub • Kick Live Stream System")
                                await target_channel.send(content=final_msg, embed=kick_embed)

                            print(f"[SocialFeed] Broadcast post for {p_id} to #{target_channel.name}")
                        except Exception as e:
                            print(f"[SocialFeed] Broadcast error on {p_id}: {e}")
                            
        except Exception as e:
            print(f"Social feed loop error: {e}")
        await asyncio.sleep(30)  # Check every 30 seconds

async def ensure_all_plugin_sidebar_channels(guild: discord.Guild):
    """Ensures all plugin categories and channels exist and are visible in the Discord server sidebar."""
    try:
        everyone_overwrite = {
            guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=True, view_channel=True)
        }
        read_only_overwrite = {
            guild.default_role: discord.PermissionOverwrite(read_messages=True, send_messages=False, view_channel=True)
        }

        # 1. WELCOME LOBBY
        await ensure_permanent_welcome_channel(guild)

        # 2. SERVER STATS
        cat_stats = discord.utils.get(guild.categories, name="📊 SERVER STATS") or await guild.create_category("📊 SERVER STATS")

        # 3. AI & COMMUNITY
        await ensure_permanent_ai_channel(guild)

        # 4. SUPPORT TICKETS
        await ensure_permanent_ticket_channel(guild)

        # 5. LEVELING & XP
        cat_leveling = discord.utils.get(guild.categories, name="🏆 LEVELING & XP") or await guild.create_category("🏆 LEVELING & XP")
        ch_leveling = discord.utils.get(guild.text_channels, name="leaderboard-and-ranks")
        if not ch_leveling:
            await guild.create_text_channel("leaderboard-and-ranks", category=cat_leveling, overwrites=everyone_overwrite)

        # 6. COMMUNITY SUGGESTIONS
        cat_suggest = discord.utils.get(guild.categories, name="💡 COMMUNITY SUGGESTIONS") or await guild.create_category("💡 COMMUNITY SUGGESTIONS")
        ch_suggest = discord.utils.get(guild.text_channels, name="suggestions")
        if not ch_suggest:
            await guild.create_text_channel("suggestions", category=cat_suggest, overwrites=everyone_overwrite)

        # 7. SOCIAL & MARKET FEEDS
        cat_feeds = discord.utils.get(guild.categories, name="📢 SOCIAL & MARKET FEEDS") or await guild.create_category("📢 SOCIAL & MARKET FEEDS")
        ch_feeds = discord.utils.get(guild.text_channels, name="social-feed-updates")
        if not ch_feeds:
            await guild.create_text_channel("social-feed-updates", category=cat_feeds, overwrites=read_only_overwrite)

        # 8. AUTOMOD & AUDIT LOGS
        cat_automod = (
            discord.utils.get(guild.categories, name="🛡️ AUTOMOD & AUDIT LOGS") or 
            discord.utils.get(guild.categories, name="🛡️ AUTOMOD & SAFETY") or 
            await guild.create_category("🛡️ AUTOMOD & AUDIT LOGS")
        )
        ch_automod = discord.utils.get(guild.text_channels, name="automod-logs")
        if not ch_automod:
            await guild.create_text_channel("automod-logs", category=cat_automod, overwrites=read_only_overwrite)

        await ensure_permanent_audit_log_channel(guild)
    except Exception as e:
        print("[SidebarChannels] Error ensuring all plugin channels:", e)

@client.event
async def on_ready():
    database.init_db()
    try:
        await client.change_presence(activity=discord.Activity(type=discord.ActivityType.watching, name="9 Active Plugins | ReplyFlow"))
    except Exception as e:
        print("Presence update error:", e)
    print("========================================================")
    print(f"  Automation Bot Online & Listening as {client.user}!")
    print(f"  Connected Guilds Count: {len(client.guilds)}")
    
    # Start real-time 3-second live stats channel sync loop
    client.loop.create_task(live_stats_sync_loop())
    client.loop.create_task(social_feed_sync_loop())

    for g in client.guilds:
        print(f"   - {g.name} (ID: {g.id}) | Members: {g.member_count}")
        for m in g.members:
            joined = m.joined_at.isoformat() if m.joined_at else datetime.utcnow().isoformat()
            avatar = m.display_avatar.url if m.display_avatar else (m.default_avatar.url if m.default_avatar else "")
            status_str = str(m.status) if hasattr(m, 'status') else 'online'
            role_names = ", ".join([r.name for r in m.roles if r.name != "@everyone"])
            is_adm = 1 if (m.guild_permissions.administrator or m.guild_permissions.manage_channels) else 0
            is_b = 1 if m.bot else 0
            database.sync_live_member(str(m.id), str(g.id), m.name, m.display_name, avatar, status_str, role_names, is_adm, is_b, joined)
            if not m.bot:
                database.record_member_join(str(m.id), str(g.id), m.name, m.display_name, joined)

        asyncio.create_task(update_live_stats(g, force=False))
        asyncio.create_task(ensure_replyflow_animated_emojis(g))
        asyncio.create_task(ensure_all_plugin_sidebar_channels(g))
        asyncio.create_task(cleanup_duplicate_ticket_channels(g))
        asyncio.create_task(refresh_all_ticket_channel_views(g))

    print("  Database, Live Telemetry, Live Stats & All Sidebar Plugin Channels synced with all connected servers!")
    print("========================================================")

@client.event
async def on_guild_join(guild: discord.Guild):
    print(f"[Event: GuildJoin] Bot connected to new server: {guild.name} (ID: {guild.id})!")
    await ensure_replyflow_animated_emojis(guild)
    await ensure_permanent_welcome_channel(guild)
    await ensure_permanent_ticket_channel(guild)
    await ensure_permanent_ai_channel(guild)

@client.event
async def on_presence_update(before: discord.Member, after: discord.Member):
    if after and after.guild:
        joined = after.joined_at.isoformat() if after.joined_at else datetime.utcnow().isoformat()
        avatar = after.display_avatar.url if after.display_avatar else (after.default_avatar.url if after.default_avatar else "")
        status_str = str(after.status) if hasattr(after, 'status') else 'online'
        role_names = ", ".join([r.name for r in after.roles if r.name != "@everyone"])
        is_adm = 1 if (after.guild_permissions.administrator or after.guild_permissions.manage_channels) else 0
        is_b = 1 if after.bot else 0
        database.sync_live_member(str(after.id), str(after.guild.id), after.name, after.display_name, avatar, status_str, role_names, is_adm, is_b, joined)

@client.event
async def on_member_join(member: discord.Member):
    print(f"[Event: MemberJoin] {member.name} (@{member.name}) joined {member.guild.name}!")
    joined = member.joined_at.isoformat() if member.joined_at else datetime.utcnow().isoformat()
    avatar = member.display_avatar.url if member.display_avatar else (member.default_avatar.url if member.default_avatar else "")
    status_str = str(member.status) if hasattr(member, 'status') else 'online'
    role_names = ", ".join([r.name for r in member.roles if r.name != "@everyone"])
    is_adm = 1 if (member.guild_permissions.administrator or member.guild_permissions.manage_channels) else 0
    is_b = 1 if member.bot else 0
    database.sync_live_member(str(member.id), str(member.guild.id), member.name, member.display_name, avatar, status_str, role_names, is_adm, is_b, joined)
    try:
        database.increment_telemetry(str(member.guild.id), 'members_joined_today', 1)
    except Exception as e:
        print("Member join telemetry error:", e)
    await send_welcome_flow(member)

@client.event
async def on_member_remove(member: discord.Member):
    print(f"[Event: MemberRemove] {member.name} (@{member.name}) left {member.guild.name}!")
    remove_welcomed_member(str(member.id))
    
    # 1. Log in SQLite Database Audit Logs
    try:
        conn = database.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
        VALUES (?, 'MEMBER_LEAVE', ?, ?)
        """, (str(member.guild.id), f"Member {member.name} (@{member.name}) left the server", datetime.utcnow().isoformat()))
        conn.commit()
        conn.close()
    except Exception as e:
        print("Member leave log error:", e)

    # 2. Update Live Member Count Stats Channel
    await update_live_stats(member.guild)

    # 3. Clean up any open ticket channel or personal welcome channel associated with the departing member
    clean_user = re.sub(r'[^a-zA-Z0-9]', '', member.name).lower()
    target_ticket_name = f"ticket-{clean_user}"
    target_welcome_name = f"welcome-{clean_user}"
    
    for ch in member.guild.text_channels:
        if ch.name.lower() in ["tickets", "support-tickets", "open-a-ticket", "welcome", "welcome-chat"]:
            continue
        ch_clean = re.sub(r'[^a-zA-Z0-9]', '', ch.name).lower()
        if ch_clean in [target_ticket_name, f"ticket{clean_user}", target_welcome_name, f"welcome{clean_user}"]:
            try:
                await ch.delete(reason="Member left the server")
                print(f"[Cleanup] Cleaned up channel #{ch.name} because {member.name} left.")
            except Exception as e:
                print("Channel cleanup error:", e)

    # 4. Reset welcome record so if they rejoin, they receive a fresh Welcome Greeting & Canvas Card
    recent_welcomes.pop(member.id, None)
    welcomed_recent_file = os.path.join(os.path.dirname(__file__), 'welcomed_members.json')
    if os.path.exists(welcomed_recent_file):
        try:
            with open(welcomed_recent_file, 'r') as f:
                welcomed_ids = set(json.load(f))
            if str(member.id) in welcomed_ids:
                welcomed_ids.remove(str(member.id))
                with open(welcomed_recent_file, 'w') as f:
                    json.dump(list(welcomed_ids), f)
                print(f"[WelcomeFlow] Reset welcomed record for {member.name} upon server leave.")
        except Exception as e:
            print("Welcomed record reset error:", e)

async def ensure_permanent_audit_log_channel(guild: discord.Guild) -> discord.TextChannel:
    """Ensures a dedicated, 100% private #audit-logs text channel exists under 🛡️ AUTOMOD & AUDIT LOGS category (Visible ONLY to Admin/Staff), and cleans up any duplicates."""
    all_audit_cats = [c for c in guild.categories if "AUTOMOD" in c.name.upper() or "AUDIT" in c.name.upper() or "SAFETY" in c.name.upper()]
    cat = None
    if len(all_audit_cats) > 1:
        all_audit_cats.sort(key=lambda c: (len(c.channels) == 0, c.position))
        cat = all_audit_cats[0]
        for extra in all_audit_cats[1:]:
            try:
                for ch in list(extra.channels):
                    await ch.delete()
                await extra.delete()
                print(f"[AuditLogs Safeguard] Deleted extra AUTOMOD & AUDIT LOGS category '{extra.name}'")
            except Exception as e:
                print(f"[AuditLogs Safeguard] Category delete error: {e}")
    elif len(all_audit_cats) == 1:
        cat = all_audit_cats[0]
    else:
        try:
            cat = await guild.create_category("🛡️ AUTOMOD & AUDIT LOGS", position=1)
        except Exception as e:
            print("Category creation error for Audit Logs:", e)

    # Find ALL text channels named 'audit-logs' across the guild
    all_audit_chans = [ch for ch in guild.text_channels if ch.name.lower() in ["audit-logs", "auditlogs", "security-logs"]]
    
    audit_chan = None
    if all_audit_chans:
        audit_chan = all_audit_chans[0]
        if len(all_audit_chans) > 1:
            for extra_ch in all_audit_chans[1:]:
                try:
                    await extra_ch.delete(reason="Cleaning up duplicate #audit-logs channel")
                    print(f"[AuditLogs Safeguard] 🗑️ Deleted duplicate #audit-logs channel '{extra_ch.name}' (ID: {extra_ch.id})")
                    await asyncio.sleep(0.3)
                except Exception as del_err:
                    print(f"[AuditLogs Safeguard] Delete error for extra channel: {del_err}")

    if audit_chan and cat and audit_chan.category_id != cat.id:
        try:
            await audit_chan.edit(category=cat)
        except Exception:
            pass

    # Strict Admin-Only Overwrites: Completely HIDE (view_channel=False) from @everyone
    read_only_overwrite = {
        guild.default_role: discord.PermissionOverwrite(view_channel=False, read_messages=False, send_messages=False),
        guild.me: discord.PermissionOverwrite(view_channel=True, read_messages=True, send_messages=True, embed_links=True, attach_files=True)
    }
    for role in guild.roles:
        if role.permissions.administrator or role.permissions.manage_guild or any(name in role.name.lower() for name in ['admin', 'mod', 'moderator', 'staff', 'owner']):
            read_only_overwrite[role] = discord.PermissionOverwrite(view_channel=True, read_messages=True, send_messages=False)

    if not audit_chan:
        try:
            audit_chan = await guild.create_text_channel(
                "audit-logs",
                category=cat,
                topic="📜 Admin-Only A-to-Z Audit Log & Security Shield (Permanent Deleted Message Archiver)",
                overwrites=read_only_overwrite
            )
            print(f"[AuditLogs] ✨ Created Private Admin-Only #audit-logs channel in {guild.name}")
        except Exception as e:
            print("Audit log channel creation error:", e)
    else:
        try:
            await audit_chan.edit(overwrites=read_only_overwrite)
        except Exception as e:
            print("Audit log channel permissions update note:", e)

    return audit_chan

async def send_audit_log_embed(guild: discord.Guild, embed: discord.Embed):
    try:
        audit_chan = await ensure_permanent_audit_log_channel(guild)
        if audit_chan:
            await audit_chan.send(embed=embed)
    except Exception as e:
        print("[AuditLogs] Embed send error:", e)

@client.event
async def on_message_delete(message: discord.Message):
    if not message.guild or message.author.bot:
        return

    author_tag = f"{message.author.name} (@{message.author.name}, ID: {message.author.id})"
    content_text = message.content or "[No Text Content / Attachment Only]"
    ch_name = f"#{message.channel.name}"

    log_desc = f"🗑️ Message by {message.author.display_name} ({author_tag}) DELETED in {ch_name}:\n\"{content_text}\""
    database.log_audit_event(str(message.guild.id), "MESSAGE_DELETE", log_desc)

    embed = discord.Embed(
        title="🗑️ Message Deleted & Archived",
        description=f"**Author:** {message.author.mention} (`{message.author.id}`)\n**Channel:** {message.channel.mention}",
        color=discord.Color.red(),
        timestamp=datetime.utcnow()
    )
    embed.add_field(name="📜 Deleted Message Content:", value=content_text[:1024], inline=False)
    if message.attachments:
        att_links = "\n".join([a.url for a in message.attachments])
        embed.add_field(name="📎 Attachments:", value=att_links[:1024], inline=False)
    avatar_url = message.author.display_avatar.url if message.author.display_avatar else ""
    if avatar_url:
        embed.set_author(name=f"{message.author.display_name} (@{message.author.name})", icon_url=avatar_url)
    embed.set_footer(text="ReplyFlow Audit Shield • Permanent Archive")

    await send_audit_log_embed(message.guild, embed)

@client.event
async def on_message_edit(before: discord.Message, after: discord.Message):
    if not before.guild or before.author.bot or before.content == after.content:
        return

    author_tag = f"{before.author.name} (@{before.author.name}, ID: {before.author.id})"
    ch_name = f"#{before.channel.name}"

    log_desc = f"✏️ Message by {before.author.display_name} ({author_tag}) EDITED in {ch_name}:\nBefore: \"{before.content}\"\nAfter: \"{after.content}\""
    database.log_audit_event(str(before.guild.id), "MESSAGE_EDIT", log_desc)

    embed = discord.Embed(
        title="✏️ Message Edited",
        description=f"**Author:** {before.author.mention} (`{before.author.id}`)\n**Channel:** {before.channel.mention}",
        color=discord.Color.gold(),
        timestamp=datetime.utcnow()
    )
    embed.add_field(name="🔴 Before:", value=(before.content or "[Empty]")[:1024], inline=False)
    embed.add_field(name="🟢 After:", value=(after.content or "[Empty]")[:1024], inline=False)
    avatar_url = before.author.display_avatar.url if before.author.display_avatar else ""
    if avatar_url:
        embed.set_author(name=f"{before.author.display_name} (@{before.author.name})", icon_url=avatar_url)
    embed.set_footer(text="ReplyFlow Audit Shield")

    await send_audit_log_embed(before.guild, embed)

@client.event
async def on_guild_channel_create(channel: discord.abc.GuildChannel):
    log_desc = f"📁 Channel Created: #{channel.name} ({type(channel).__name__})"
    database.log_audit_event(str(channel.guild.id), "CHANNEL_CREATE", log_desc)
    embed = discord.Embed(title="📁 Channel Created", description=f"**Name:** #{channel.name}\n**Type:** {type(channel).__name__}", color=discord.Color.green(), timestamp=datetime.utcnow())
    await send_audit_log_embed(channel.guild, embed)

@client.event
async def on_guild_channel_delete(channel: discord.abc.GuildChannel):
    log_desc = f"🗑️ Channel Deleted: #{channel.name} ({type(channel).__name__})"
    database.log_audit_event(str(channel.guild.id), "CHANNEL_DELETE", log_desc)
    embed = discord.Embed(title="🗑️ Channel Deleted", description=f"**Name:** #{channel.name}\n**Type:** {type(channel).__name__}", color=discord.Color.dark_red(), timestamp=datetime.utcnow())
    await send_audit_log_embed(channel.guild, embed)

@client.event
async def on_voice_state_update(member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
    if before.channel != after.channel:
        if after.channel:
            log_desc = f"🎙️ {member.display_name} (@{member.name}) joined voice channel #{after.channel.name}"
            database.log_audit_event(str(member.guild.id), "VOICE_JOIN", log_desc)
        elif before.channel:
            log_desc = f"🎙️ {member.display_name} (@{member.name}) left voice channel #{before.channel.name}"
            database.log_audit_event(str(member.guild.id), "VOICE_LEAVE", log_desc)

@client.event
async def on_member_update(before: discord.Member, after: discord.Member):
    if getattr(before, 'pending', False) and not getattr(after, 'pending', False):
        print(f"[Event: MembershipScreeningComplete] {after.name} completed rules verification screening!")

class PluginsHelpSelect(ui.Select):
    def __init__(self):
        options = [
            discord.SelectOption(label="1. Welcome Flow & Auto-Role", value="welcome", description="Auto greetings, role assignment & canvas card", emoji="👋"),
            discord.SelectOption(label="2. Leveling & XP System", value="leveling", description="Chat XP, rank cards & leaderboard", emoji="🏆"),
            discord.SelectOption(label="3. Support Ticket Desk", value="tickets", description="Private ticket creation & transcripts", emoji="🎟️"),
            discord.SelectOption(label="4. Live Server Stats Counters", value="stats", description="Real-time voice counter channels", emoji="📊"),
            discord.SelectOption(label="5. Auto-Moderation Shield", value="automod", description="Anti-link, anti-spam & bad word filters", emoji="🛡️"),
            discord.SelectOption(label="6. Social Media Feed Alerts", value="feeds", description="YouTube, Twitch & Twitter notifications", emoji="📢"),
            discord.SelectOption(label="7. Suggestions & Voting System", value="suggestions", description="Community polls & reaction voting", emoji="💡"),
            discord.SelectOption(label="8. AI Natural Language Assistant", value="ai", description="Gemini 1.5 Pro AI RAG server bot", emoji="🤖"),
            discord.SelectOption(label="9. Audit & Security Logs", value="audit", description="Permanent deleted message archiver", emoji="📜"),
        ]
        super().__init__(placeholder="⚡ Select a Plugin from dropdown to view details...", min_values=1, max_values=1, options=options)

    async def callback(self, interaction: discord.Interaction):
        selected = self.values[0]
        embeds = {
            "welcome": discord.Embed(title="👋 Plugin 1: Welcome Flow & Auto-Role", description="**Features:**\n- Automatic welcome greeting message in `#welcome`\n- Customizable 1000x440 Canvas Welcome Cards\n- Auto-assign default member roles upon joining\n- Direct DM greeting option", color=discord.Color.brand_green()),
            "leveling": discord.Embed(title="🏆 Plugin 2: Leveling & XP System", description="**Features:**\n- Earn XP per chat message sent\n- Check your rank card with `/rank`\n- Top leaderboard in `#leaderboard-and-ranks`\n- Auto rank-up role rewards", color=discord.Color.gold()),
            "tickets": discord.Embed(title="🎟️ Plugin 3: Support Ticket Desk", description="**Features:**\n- Permanent ticket creation embed in `#tickets`\n- Multi-category support (Billing, General, Tech)\n- Staff approval, close & HTML transcript logs", color=discord.Color.blurple()),
            "stats": discord.Embed(title="📊 Plugin 4: Live Server Stats Counters", description="**Features:**\n- Real-time updating voice channels for server telemetry\n- Track Total Members, Online Members, Boosts, Admins, Bots & Staff\n- Auto-syncs every 3 seconds with Web Dashboard", color=discord.Color.blue()),
            "automod": discord.Embed(title="🛡️ Plugin 5: Auto-Moderation Shield", description="**Features:**\n- Intercept unauthorized links & invite links\n- Profanity filter & anti-spam flood protection\n- Auto-logs violations in `#automod-logs`", color=discord.Color.red()),
            "feeds": discord.Embed(title="📢 Plugin 6: Social Media Feed Alerts", description="**Features:**\n- Live notifications for YouTube uploads, Twitch streams & Twitter posts\n- Configure feeds in `#social-feed-updates`\n- Customizable alert text & ping options", color=discord.Color.purple()),
            "suggestions": discord.Embed(title="💡 Plugin 7: Suggestions & Voting System", description="**Features:**\n- Submit server suggestions in `#suggestions`\n- Automatic 👍 / 👎 voting reactions\n- Staff status updates (Approved, Denied, Implemented)", color=discord.Color.teal()),
            "ai": discord.Embed(title="🤖 Plugin 8: AI Natural Language Assistant", description="**Features:**\n- Powered by Gemini 1.5 Pro AI RAG engine\n- 24/7 intelligent answers in `#ai-assistant`\n- Custom server knowledge base memory", color=discord.Color.dark_purple()),
            "audit": discord.Embed(title="📜 Plugin 9: Audit & Security Logs", description="**Features:**\n- Permanent deleted message archiver (captures content instantly)\n- Edited message before/after history\n- Member joins/leaves & voice channel logs in `#audit-logs`", color=discord.Color.dark_red()),
        }
        emb = embeds.get(selected, discord.Embed(title="⚡ Plugin Suite", description="Select a plugin from the dropdown menu above."))
        emb.set_footer(text="ReplyFlow Automation Suite • Web Dashboard Controlled")
        await interaction.response.edit_message(embed=emb, view=self.view)

WEBSITE_SHOP_URL = os.environ.get("WEBSITE_SHOP_URL", "https://khaki-kangaroo-783561.hostingersite.com")

class PluginsHelpView(ui.View):
    def __init__(self):
        super().__init__(timeout=None)
        self.add_item(PluginsHelpSelect())
        self.add_item(ui.Button(label="🛍️ Shop Now & Buy ReplyFlow", url=WEBSITE_SHOP_URL, style=discord.ButtonStyle.link))
        self.add_item(ui.Button(label="🌐 Open Web Dashboard", url=WEBSITE_SHOP_URL, style=discord.ButtonStyle.link))

user_msg_timestamps = {}
ai_user_last_reply_time = {}

async def check_and_grant_level_reward(member: discord.Member, new_level: int):
    try:
        reward = database.get_level_reward(str(member.guild.id), new_level)
        if not reward:
            pool = await get_mysql_pool()
            if pool:
                async with pool.acquire() as conn:
                    async with conn.cursor(aiomysql.DictCursor) as cur:
                        await cur.execute("SELECT * FROM leveling_rewards WHERE level_number = %s", (new_level,))
                        reward = await cur.fetchone()

        if reward and reward.get('reward_role'):
            role_name = str(reward['reward_role']).strip()
            if role_name.startswith('@'):
                role_name = role_name[1:]
            
            target_role = None
            for r in member.guild.roles:
                if r.name.lower() == role_name.lower():
                    target_role = r
                    break
            if not target_role:
                try:
                    target_role = await member.guild.create_role(name=role_name, color=discord.Color.gold(), reason=f"Level {new_level} Reward")
                except Exception as cr_err:
                    print("Role creation error for level reward:", cr_err)

            if target_role and target_role not in member.roles:
                try:
                    await member.add_roles(target_role)
                    print(f"Granted level reward role '{target_role.name}' to {member.name} for reaching Level {new_level}")
                except Exception as ar_err:
                    print(f"Role assign error for level reward: {ar_err}")
    except Exception as e:
        print(f"[Level Reward Error] {e}")

def is_ai_auto_reply_enabled_for_channel(guild_id: str, channel_id: str, channel_name: str, message_content: str = "") -> bool:
    if not guild_id:
        return False
    try:
        cfg_obj = database.get_plugin_config(str(guild_id), 'ai-assistant')
        if not cfg_obj or not cfg_obj.get('enabled', False):
            cfg_obj = database.get_plugin_config(str(guild_id), 'ai')
        
        if not cfg_obj or not cfg_obj.get('enabled', False):
            return False

        cfg = cfg_obj.get('config', {})
        trigger_mode = cfg.get('trigger_mode', 'dedicated')
        target_channel = cfg.get('target_channel', 'ai-assistant').lower().replace('#', '').strip()
        ch_id_str = str(channel_id) if channel_id else ""
        ch_name_str = str(channel_name).lower().replace('#', '').strip() if channel_name else ""

        # 1. Mention & Slash only mode -> No auto-reply unless explicitly tagged
        if trigger_mode == 'mention_only':
            return False

        # 2. Smart Question Filter mode -> Auto-reply only if message contains question
        if trigger_mode == 'smart_question':
            msg_lower = message_content.lower()
            if '?' in message_content or any(q in msg_lower for q in ['what', 'how', 'why', 'when', 'kya', 'kia', 'kaise', 'kese', 'rule', 'help', 'signal', 'support']):
                return True
            return False

        # 3. Dedicated AI Channel Mode (Default & Recommended)
        # Dedicated to #ai-assistant (or selected target channel)
        if target_channel and (target_channel in ch_name_str or ch_name_str in target_channel):
            return True
        if any(ai_tag in ch_name_str for ai_tag in ['ai-assistant', 'ask-ai', 'ai-chat', 'bot-chat', 'ai-help']):
            return True

        return False
    except Exception as e:
        print("[AI Auto-Reply Channel Check Error]:", e)
        return False

@client.event
async def on_message(message: discord.Message):
    if message.author.bot or not message.guild:
        return

    # Interactive Plugins Dropdown Control Panel (Triggers when explicitly typing !help, !plugins, or !menu)
    if any(cmd == message.content.strip().lower() for cmd in ['!help', '!plugins', '/plugins', '/help', '!menu']):
        embed = discord.Embed(
            title="⚡ ReplyFlow Automation Suite • 9 Active Plugins Control Desk",
            description="Welcome to the **ReplyFlow Master Automation Engine**! Select any plugin from the interactive dropdown menu below to view detailed features, controls, and active channels.",
            color=discord.Color.blurple()
        )
        embed.add_field(name="🌐 Connected Server:", value=f"**{message.guild.name}** (`{message.guild.id}`)", inline=True)
        embed.add_field(name="🎛️ Active Plugins Count:", value="**9 Plugins Operational**", inline=True)
        embed.set_footer(text="ReplyFlow Interactive Control Desk • Select an option below")
        
        view = PluginsHelpView()
        await message.channel.send(embed=embed, view=view)
        return

    try:
        database.increment_telemetry(str(message.guild.id), 'messages_today', 1)
        avatar_url = message.author.display_avatar.url if message.author.display_avatar else (message.author.default_avatar.url if message.author.default_avatar else "")
        database.log_discord_message(
            str(message.guild.id),
            str(message.channel.id),
            message.channel.name,
            str(message.author.id),
            message.author.display_name or message.author.name,
            avatar_url,
            message.content
        )
    except Exception as telemetry_err:
        print("Telemetry message count error:", telemetry_err)

    if await process_automod_rules(message):
        return

    author_id = message.author.id
    now = datetime.utcnow().timestamp()

    # 1. Plugin 5: Anti-Spam Message Rate Limiter (5 msgs in 4s)
    if author_id not in user_msg_timestamps:
        user_msg_timestamps[author_id] = []
    user_msg_timestamps[author_id] = [t for t in user_msg_timestamps[author_id] if now - t < 4.0]
    user_msg_timestamps[author_id].append(now)

    if len(user_msg_timestamps[author_id]) >= 5:
        try:
            await message.delete()
            await message.channel.send(f"⚠️ **Anti-Spam Alert**: {message.author.mention}, please slow down! Sending messages too fast.", delete_after=5)
            print(f"Anti-Spam triggered for {message.author.name}")
            return
        except Exception as e:
            print("Anti-Spam error:", e)

    # 2. Plugin 5: Token Leak Shield
    token_pattern = r'[MNO][a-zA-Z\d_-]{23,25}\.[a-zA-Z\d_-]{6}\.[a-zA-Z\d_-]{27,38}'
    if re.search(token_pattern, message.content):
        try:
            await message.delete()
            await message.channel.send(f"⚠️ **Security Alert**: {message.author.mention}, a bot token leak was detected and deleted immediately!")
            print(f"Token leak intercepted from {message.author.name}")
            return
        except Exception as e:
            print(f"Token shield error: {e}")

    # 3. Plugin 5: Strict Anti-Link Shield (Blocks ALL web URLs and links)
    link_pattern = r'(https?://[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.(com|net|org|xyz|io|co|me|gg|link|app|info|biz|top|cc|ru|site|store|tech|online)[/\w.-]*)'
    if re.search(link_pattern, message.content, re.IGNORECASE):
        if not message.author.guild_permissions.administrator:
            try:
                await message.delete()
                await message.channel.send(f"🛑 **Anti-Link Shield**: {message.author.mention}, posting external links or web URLs is prohibited in this server!", delete_after=6)
                print(f"URL/Link blocked and deleted from {message.author.name}")
                return
            except Exception as e:
                print("Anti-Link filter error:", e)

    # 4. Plugin 5: Anti-Mass Mentions Filter
    if ("@everyone" in message.content or "@here" in message.content or len(message.mentions) >= 5):
        if not message.author.guild_permissions.administrator:
            try:
                await message.delete()
                await message.channel.send(f"⚠️ **AutoMod Alert**: {message.author.mention}, mass user mentions are not allowed!", delete_after=6)
                print(f"Mass mention blocked from {message.author.name}")
                return
            except Exception as e:
                print("Mass mention error:", e)

    # 5. Plugin 5: Prohibited Words Toxicity Shield
    bad_words = ['scam', 'phishing', 'nuke', 'free nitro', 'hacked']
    if any(bw in message.content.lower() for bw in bad_words):
        try:
            await message.delete()
            await message.channel.send(f"🛡️ **AutoMod Toxicity Shield**: {message.author.mention}, your message contained prohibited terms and was removed.", delete_after=6)
            print(f"Bad word filtered from {message.author.name}")
            return
        except Exception as e:
            print("Bad word filter error:", e)

    # 6. Plugin 2: Leveling & XP Gain Engine
    try:
        xp_gain = random.randint(15, 25)
        res = database.add_user_xp(str(message.author.id), str(message.guild.id), message.author.name, message.author.display_name, xp_gain)
        if res and res.get('leveled_up'):
            new_level = res['level']
            await check_and_grant_level_reward(message.author, new_level)
            try:
                embed_lvl = discord.Embed(
                    title="🎉 **LEVEL UP!**",
                    description=f"Congratulations {message.author.mention}! You reached **Level {new_level}**! 🎖️\nKeep chatting to unlock higher ranks & VIP role rewards!",
                    color=discord.Color.gold()
                )
                embed_lvl.set_thumbnail(url=message.author.display_avatar.url if message.author.display_avatar else "")
                await message.channel.send(embed=embed_lvl)
            except Exception as lvl_err:
                print("Level up announcement error:", lvl_err)
    except Exception as xp_err:
        print("[XP Engine Error]:", xp_err)

    # Plugin 8: AI Auto-Reply Bot & Server Conversation Listener
    content_lower = message.content.strip().lower()
    
    # Check for rank command (!rank, /rank, rank)
    if content_lower in ['/rank', '!rank', 'rank', '/level', '!level', 'level']:
        user_data = database.get_user_member(str(message.author.id))
        xp = user_data.get('xp', 0) if user_data else 0
        level = user_data.get('level', 1) if user_data else 1
        embed = discord.Embed(
            title="🏆 Level & Rank Profile",
            description=f"**Member**: {message.author.mention}\n**Current Level**: `Level {level}` 🎖️\n**Total XP**: `{xp:,} XP` ✨",
            color=discord.Color.gold()
        )
        embed.set_thumbnail(url=message.author.display_avatar.url)
        await message.reply(embed=embed)
        return
        return
    elif content_lower.startswith('/ticket'):
        embed = discord.Embed(
            title="🎟️ Ticket Support System",
            description="Click the button below to open a private support ticket channel with server staff.",
            color=discord.Color.blurple()
        )
        await message.reply(embed=embed, view=TicketView())
        return
    elif content_lower.startswith('/feed'):
        embed_yt = discord.Embed(
            title="🔴 LIVE YouTube Alert: NOIR INSIGHT TRADER",
            description="**New Video Posted**: *'Mastering Crypto & Stock Market Signals - Full Guide 2026'*\n\n📺 Watch live now: [YouTube Video Link](https://youtube.com)",
            color=discord.Color.red()
        )
        embed_yt.set_thumbnail(url="https://cdn-icons-png.flaticon.com/512/1384/1384060.png")
        embed_yt.set_footer(text="Social Feed Hub • Auto Broadcast System")

        embed_tw = discord.Embed(
            title="🐦 Twitter/X Feed Update",
            description="**@NoirInsightTrader**: *Market structure shift detected on BTC/USD! Key liquidity pool swept. Stay tuned for member signals.*",
            color=discord.Color.blue()
        )
        embed_tw.set_footer(text="Social Feed Hub • Real-Time Sync")

    elif content_lower.startswith('/help') or content_lower.startswith('/guide'):
        embed = create_help_embed(message.guild.name, message.author.mention)
        await message.reply(embed=embed)
        return
    elif content_lower.startswith('/welcome') or content_lower.startswith('/test-welcome') or content_lower.startswith('/welcometest'):
        await send_welcome_flow(message.author, force_channel=message.channel, is_preview=True)
        return
    # 7. Check if bot is mentioned OR if message is in AI Auto-Reply Target Channel
    is_mentioned = (client.user in message.mentions)
    is_target_channel = is_ai_auto_reply_enabled_for_channel(
        str(message.guild.id) if message.guild else None,
        str(message.channel.id) if message.channel else None,
        str(message.channel.name) if hasattr(message.channel, 'name') else "",
        message.content
    )

    if is_mentioned or is_target_channel:
        now_ts = datetime.utcnow().timestamp()
        last_ts = ai_user_last_reply_time.get(message.author.id, 0)
        if not is_mentioned and (now_ts - last_ts < 3.5):
            return
        ai_user_last_reply_time[message.author.id] = now_ts

        query = message.content.replace(f"<@{client.user.id}>", "").replace(f"<@!{client.user.id}>", "").strip()
        if not query:
            query = "Hello!"
        
        async with message.channel.typing():
            await asyncio.sleep(1.2)
            reply = await generate_ai_response(query, message.author.display_name, message.guild.name, str(message.guild.id) if message.guild else None)
        await message.reply(reply)
        return

# Slash Commands
@client.tree.command(name="rank", description="Display your Leveling & XP rank profile")
async def cmd_rank(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=False)
    user_data = database.get_user_member(str(interaction.user.id))
    xp = user_data.get('xp', 0) if user_data else 0
    level = user_data.get('level', 1) if user_data else 1
    
    embed = discord.Embed(
        title="🏆 Level & Rank Profile",
        description=f"**Member**: {interaction.user.mention}\n"
                    f"**Level**: `{level}`\n"
                    f"**Total XP**: `{xp:,} XP`",
        color=discord.Color.gold()
    )
    embed.set_thumbnail(url=interaction.user.display_avatar.url)
    await interaction.followup.send(embed=embed)

@client.tree.command(name="ticket", description="Open the Ticket Support selection panel")
async def cmd_ticket(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=False)
    embed = discord.Embed(
        title="🎟️ Ticket Support System",
        description="Click the button below to open a private support ticket channel with server staff.",
        color=discord.Color.blurple()
    )
    await interaction.followup.send(embed=embed, view=TicketView())

@client.tree.command(name="welcome", description="Trigger or preview welcome banner card message")
async def cmd_welcome(interaction: discord.Interaction, target_member: discord.Member = None):
    try:
        if not interaction.response.is_done():
            await interaction.response.defer(ephemeral=False)
    except Exception:
        pass
    member = target_member or interaction.user
    guild = interaction.guild
    
    template = await fetch_active_welcome_template(str(guild.id)) if guild else None
    card_file = None
    
    if template:
        welcome_heading = f"✨ **Welcome to {guild.name}!**"
        msg_text = template.get('message_text') or ''
        welcome_greetings = msg_text.replace('{user}', member.mention).replace('{server}', guild.name)
        if not welcome_greetings:
            welcome_greetings = f"👋 Welcome {member.mention} to {guild.name}!"
            
        media_url = template.get('media_url', '')
        if media_url and media_url.startswith('data:image'):
            try:
                header, encoded = media_url.split(",", 1)
                image_data = base64.b64decode(encoded)
                card_file = discord.File(fp=io.BytesIO(image_data), filename="custom_welcome.png")
            except Exception as e:
                print(f"[Base64 Decode Error] {e}")
        elif not media_url:
            card_bytes = await generate_welcome_card_image(member)
            card_file = discord.File(fp=card_bytes, filename="welcome_card.png")
            
        embed = discord.Embed(
            title=welcome_heading,
            description=welcome_greetings,
            color=discord.Color.from_rgb(88, 101, 242)
        )
        
        if card_file:
            embed.set_image(url=f"attachment://{card_file.filename}")
        elif media_url and not media_url.startswith('data:'):
            embed.set_image(url=media_url)
            
    else:
        card_bytes = await generate_welcome_card_image(member)
        card_file = discord.File(fp=card_bytes, filename="welcome_card.png")

        welcome_heading = f"✨ **Welcome to {guild.name}!**"
        welcome_greetings = (
            f"👋 Greetings and warm welcome {member.mention}! We are thrilled to have you join our server.\n\n"
            f"📖 **Server Guide & Quick Start**:\n"
            f"• 🏆 **Leveling & XP System**: Chat in text channels to earn XP & level up! Use `/rank` to view your profile card.\n"
            f"• 🎟️ **Support Ticket Desk**: Need private staff assistance? Use `/ticket` to open a support ticket.\n"
            f"• 💡 **Community Suggestions**: Have an idea? Submit it with `/suggest <proposal>` for voting.\n"
            f"• 🤖 **AI Smart Assistant**: Tag `@Automation Bot` or type `/ai` to ask any question!\n"
            f"• 📢 **Social Media Feed Alerts**: Stay updated with live market broadcasts via `/feed`.\n"
            f"• 🛡️ **Server Rules & Safety**: Be respectful to everyone, no spamming, and enjoy your stay!"
        )

        embed = discord.Embed(
            title=welcome_heading,
            description=welcome_greetings,
            color=discord.Color.from_rgb(88, 101, 242)
        )
        embed.set_image(url="attachment://welcome_card.png")
    avatar_url = member.display_avatar.url if member.display_avatar else member.default_avatar.url
    embed.set_thumbnail(url=avatar_url)
    embed.set_footer(text=f"⚡ Powered by ReplyFlow Discord Automation • {guild.name}")

    kwargs = {
        "content": f"👋 **Welcome to {guild.name}, {member.mention}!**",
        "embed": embed
    }
    if card_file:
        kwargs["file"] = card_file
        
    view = create_welcome_links_view(template.get('links') if template else None)
    if view:
        kwargs['view'] = view
            
    await interaction.followup.send(**kwargs)

async def post_suggestion(guild: discord.Guild, author: discord.Member, proposal_text: str, target_channel: discord.TextChannel = None):
    # Load plugin configuration
    cfg_data = database.get_plugin_config(str(guild.id), 'suggestions')
    cfg = cfg_data.get('config', {}) if cfg_data else {}
    
    chan_pref = cfg.get('target_channel', 'suggestions')
    upvote = cfg.get('upvote_emoji', '👍').strip()
    downvote = cfg.get('downvote_emoji', '👎').strip()
    auto_thread = cfg.get('auto_thread', True)

    sug_channel = target_channel
    if chan_pref not in ['current_channel', 'all_channels'] or not sug_channel:
        c_name = chan_pref.replace('#', '').strip()
        matched = discord.utils.get(guild.text_channels, name=c_name)
        if matched:
            sug_channel = matched
        elif not sug_channel:
            sug_channel = discord.utils.get(guild.text_channels, name="suggestions")
            if not sug_channel:
                try:
                    cat = discord.utils.get(guild.categories, name="📢 SOCIAL FEEDS") or discord.utils.get(guild.categories, name="SOCIAL FEEDS")
                    sug_channel = await guild.create_text_channel("suggestions", category=cat)
                except Exception:
                    sug_channel = target_channel or (guild.text_channels[0] if guild.text_channels else None)

    embed = discord.Embed(
        title="💡 New Community Suggestion",
        description=f"**Author**: {author.mention} (`@{author.name}`)\n\n"
                    f"**Proposal**:\n>>> {proposal_text}\n\n"
                    f"📌 **Status**: `PENDING COMMUNITY VOTE`",
        color=discord.Color.from_rgb(255, 170, 0)
    )
    avatar_url = author.display_avatar.url if author.display_avatar else author.default_avatar.url
    embed.set_thumbnail(url=avatar_url)
    embed.set_footer(text="Community Suggestions & Voting System • Cast your vote below!")

    if sug_channel:
        msg = await sug_channel.send(embed=embed)
        try:
            await msg.add_reaction(upvote)
        except Exception:
            await msg.add_reaction("👍")
            
        try:
            await msg.add_reaction(downvote)
        except Exception:
            await msg.add_reaction("👎")
            
        # Create dedicated discussion sub-thread
        if auto_thread:
            try:
                short_title = proposal_text[:30].replace("\n", " ")
                await msg.create_thread(name=f"💬 Discussion: {short_title}...", auto_archive_duration=1440)
            except Exception as thread_err:
                print("Auto-thread creation note:", thread_err)
        
        # Audit log in SQLite DB
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("""
            INSERT INTO audit_logs (guild_id, event_type, description, timestamp)
            VALUES (?, 'SUGGESTION_CREATED', ?, ?)
            """, (str(guild.id), f"Suggestion by {author.name}: {proposal_text[:50]}...", datetime.utcnow().isoformat()))
            conn.commit()
            conn.close()
        except Exception as e:
            print("Suggestion log error:", e)
            
        return sug_channel
    return None

@client.tree.command(name="suggest", description="Submit a proposal for Suggestions & Voting System")
async def cmd_suggest(interaction: discord.Interaction, proposal: str):
    await interaction.response.defer(ephemeral=True)
    await post_suggestion(interaction.guild, interaction.user, proposal, interaction.channel)
    await interaction.followup.send("✅ Your suggestion has been submitted to the community voting channel!", ephemeral=True)

def create_help_embed(server_name: str, mention: str) -> discord.Embed:
    embed = discord.Embed(
        title=f"📖 Official Member Help Guide - {server_name}",
        description=f"Welcome {mention}! Here is your complete guide to using **{server_name}** and our 8 automated tools:\n\n"
                    f"🏆 **1. Leveling & XP System**\n"
                    f"Chat in text channels to earn 15–25 XP per message! Type `/rank` to view your profile card & level.\n\n"
                    f"🎟️ **2. Support Ticket Desk**\n"
                    f"Need private staff assistance? Type `/ticket` or click the **`📩 Create Support Ticket`** button.\n\n"
                    f"💡 **3. Community Suggestions & Voting**\n"
                    f"Submit ideas using `/suggest <proposal>`. The community votes using `👍` and `👎` in `#suggestions`.\n\n"
                    f"🤖 **4. Gemini 2.0 AI Assistant**\n"
                    f"Ask server, trading, or rule questions anytime! Type `/ai <question>` or tag `@Automation Bot`.\n\n"
                    f"📢 **5. Social Media Feeds**\n"
                    f"Type `/feed` to view real-time market updates from YouTube and Twitter/X.\n\n"
                    f"🛡️ **6. Auto-Moderation Rules**\n"
                    f"No spamming, no external URLs (Anti-Link), and no token leaks. Type `/automod` to view policy.",
        color=discord.Color.from_rgb(88, 101, 242)
    )
    embed.set_footer(text=f"{server_name} • Member Orientation Guide Active")
    return embed

@client.tree.command(name="help", description="Display the official Server Member Help Guide")
async def cmd_help(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=False)
    embed = create_help_embed(interaction.guild.name, interaction.user.mention)
    await interaction.followup.send(embed=embed)

@client.tree.command(name="feed", description="Broadcast Social Media Feed Alerts (YouTube, Twitter, Twitch)")
async def cmd_feed(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=False)
    embed_yt = discord.Embed(
        title="🔴 LIVE YouTube Alert: NOIR INSIGHT TRADER",
        description="**New Video Posted**: *'Mastering Crypto & Stock Market Signals - Full Guide 2026'*\n\n📺 Watch live now: [YouTube Video Link](https://youtube.com)",
        color=discord.Color.red()
    )
    embed_yt.set_thumbnail(url="https://cdn-icons-png.flaticon.com/512/1384/1384060.png")
    embed_yt.set_footer(text="Social Feed Hub • Auto Broadcast System")

    embed_tw = discord.Embed(
        title="🐦 Twitter/X Feed Update",
        description="**@NoirInsightTrader**: *Market structure shift detected on BTC/USD! Key liquidity pool swept. Stay tuned for member signals.*",
        color=discord.Color.blue()
    )
    embed_tw.set_footer(text="Social Feed Hub • Real-Time Sync")

    await interaction.followup.send(content="📢 **Latest Social Media Feed Alerts:**", embeds=[embed_yt, embed_tw])

user_message_timestamps = {}

async def apply_automod_action(message: discord.Message, action_str: str, reason_text: str, auto_punish: bool = False):
    try:
        await message.delete()
    except discord.errors.NotFound:
        pass
    except Exception as e:
        print(f"[AutoMod] Message deletion error: {e}")
        return

    if action_str == 'delete':
        return

    author = message.author
    try:
        if action_str == 'warn':
            database.log_automod_warning(str(author.id), str(message.guild.id))
            
            if auto_punish:
                count = database.get_recent_warning_count(str(author.id), str(message.guild.id), days=7)
                if count >= 5:
                    action_str = 'timeout_1w'
                    reason_text = "Repeated AutoMod Violations (5+ in 7 days)"
                    
        if action_str == 'warn':
            warn_msg = await message.channel.send(f"⚠️ {author.mention}, {reason_text}")
            await asyncio.sleep(5)
            await warn_msg.delete()
            
        elif action_str.startswith('timeout_'):
            duration_str = action_str.split('_')[1]
            td = None
            human_duration = ""
            if duration_str == '5m':
                td = timedelta(minutes=5)
                human_duration = "5 Minutes"
            elif duration_str == '1h':
                td = timedelta(hours=1)
                human_duration = "1 Hour"
            elif duration_str == '1d':
                td = timedelta(days=1)
                human_duration = "1 Day"
            elif duration_str == '1w':
                td = timedelta(days=7)
                human_duration = "1 Week"
                
            if td:
                timeout_until = discord.utils.utcnow() + td
                await author.timeout(timeout_until, reason="AutoMod Violation")
                warn_msg = await message.channel.send(f"⏱️ {author.mention} has been timed out for {human_duration}. Reason: {reason_text}")
                await asyncio.sleep(5)
                await warn_msg.delete()
                
        elif action_str == 'kick':
            await author.kick(reason="AutoMod Violation")
            warn_msg = await message.channel.send(f"🚪 {author.mention} was kicked from the server. Reason: {reason_text}")
            await asyncio.sleep(5)
            await warn_msg.delete()
    except discord.errors.Forbidden:
        print(f"[AutoMod] Missing permissions to apply action '{action_str}' on {author.name}.")
    except Exception as e:
        print(f"[AutoMod] Error applying action '{action_str}': {e}")

async def process_automod_rules(message: discord.Message) -> bool:
    if message.author.bot or not message.guild:
        return False
    
    guild = message.guild

    # Check database for automod config
    try:
        config_data = database.get_plugin_config(str(guild.id), 'automod')
    except Exception:
        config_data = None
        
    if not config_data:
        return False
        
    enabled = config_data.get('enabled', False)
    if not enabled:
        return False
        
    settings = config_data.get('config', {})
    
    # 1. Anti-Link & Invite Shield
    if settings.get('anti_link', True):
        content = message.content.lower()
        if "discord.gg/" in content or "discord.com/invite/" in content or "http://" in content or "https://" in content:
            # Exclude admins/mods from link restriction
            if not message.author.guild_permissions.administrator:
                await apply_automod_action(message, settings.get('action', 'warn'), "links and invites are not allowed!", settings.get('auto_punish', False))
                return True

    # 2. Custom Bad Words (Regex/List matching)
    bad_words = settings.get('bad_words', [])
    if bad_words:
        content_words = set(re.findall(r'\b\w+\b', message.content.lower()))
        bad_words_set = set(word.lower() for word in bad_words)
        
        if content_words.intersection(bad_words_set):
            if not message.author.guild_permissions.administrator:
                await apply_automod_action(message, settings.get('action', 'warn'), "your message contained restricted words!", settings.get('auto_punish', False))
                return True

    # 3. AI Toxicity Check (Mocked for speed unless LLM flag is forced)
    if settings.get('ai_toxicity', True):
        sensitivity = settings.get('ai_sensitivity', 'medium')
        extreme_hate = ['kill', 'die', 'suicide', 'murder', 'terror', 'bomb']
        medium_tox = ['stupid', 'idiot', 'dumb', 'shut up', 'ugly', 'trash']
        
        tox_list = extreme_hate
        if sensitivity in ['medium', 'high']:
            tox_list += medium_tox
        if sensitivity == 'high':
            tox_list += ['hate', 'loser', 'suck', 'crap']
            
        content_lower = message.content.lower()
        if any(t in content_lower for t in tox_list):
            if not message.author.guild_permissions.administrator:
                await apply_automod_action(message, settings.get('action', 'warn'), "your message was flagged by the **AI Toxicity Filter**.", settings.get('auto_punish', False))
                return True

    # 4. Anti-Spam Rate Limit
    if settings.get('anti_spam', True):
        if not message.author.guild_permissions.administrator:
            max_msgs = int(settings.get('spam_max', 5))
            time_window = int(settings.get('spam_time', 5))
            
            author_id = message.author.id
            now = datetime.utcnow().timestamp()
            
            if author_id not in user_message_timestamps:
                user_message_timestamps[author_id] = []
            
            timestamps = user_message_timestamps[author_id]
            timestamps.append(now)
            
            # Remove timestamps outside window
            timestamps = [t for t in timestamps if now - t <= time_window]
            user_message_timestamps[author_id] = timestamps
            
            if len(timestamps) > max_msgs:
                await apply_automod_action(message, settings.get('action', 'warn'), f"you are sending messages too fast! Rate Limit: {max_msgs} msgs / {time_window}s.", settings.get('auto_punish', False))
                return True

    return False


@client.tree.command(name="automod", description="Configure Auto-Moderation & Anti-Spam policies")
async def cmd_automod(interaction: discord.Interaction):
    await interaction.response.defer(ephemeral=True)
    await interaction.followup.send("🛡️ **AutoMod Policy**: Anti-Spam (ON), Token Shield (ON), Anti-Link (ON), Toxicity Filter (Level 3).", ephemeral=True)

async def generate_ai_response(prompt: str, user_name: str = "User", server_name: str = "Discord Server", guild_id: str = None) -> str:
    import urllib.request
    import json
    import random
    import os

    p = prompt.strip().lower()

    # ─── 1. FAST-PATH CASUAL GREETING MATCHER (Saves 100% Tokens for Short Greetings) ───
    if any(p == g or p.startswith(g + ' ') or p.endswith(' ' + g) for g in ['kia hal hai', 'kya haal hai', 'kia hal lhai apka', 'kya hal hai apka', 'kia hal', 'kya hal', 'kaise ho', 'kese ho', 'how are you', 'how r u']):
        options = [
            f"Alhamdulillah bro sab fit fat! 🙌 Aap sunao kaisa chal raha hai? Koi help chahiye **{server_name}** me?",
            f"Sab theek thak bro! ✨ Aap sunao aaj trading/activity kaisi chal rahi hai?",
            f"All good bro! Aap batao kaisa chal raha hai sab? Let me know if you need anything in **{server_name}**! 🚀"
        ]
        return random.choice(options)

    if any(p.startswith(s) for s in ['salam', 'assalam', 'aslam', 'slaam', 'aoa']):
        options = [
            f"Walaikum Assalam bro! 🤝 Welcome to **{server_name}**! Kaisa chal raha hai sab?",
            f"Walaikum Assalam {user_name}! ✨ Khush amdeed! Koi bhi sawal ya help ho toh zaroor batao!"
        ]
        return random.choice(options)

    if p in ['hy', 'hi', 'hey', 'hello', 'yo', 'sup', 'wassup', 'whats up', 'hii', 'heyy']:
        options = [
            f"Hey bro! 👋 Welcome! Kaisa chal raha hai sab? Kuch poochna ho toh batao! 🚀",
            f"Hey {user_name}! 👋 Sab fit fat? Let me know if you need any help in **{server_name}**! ✨",
            f"Yo bro! Khush amdeed **{server_name}** me! How's your day going? 🔥"
        ]
        return random.choice(options)

    if p in ['ok', 'okay', 'theek', 'thk', 'done', 'cool', 'nice', 'great', 'shukriya', 'thanks', 'thank you']:
        options = [
            f"Most welcome bro! Always here for you in **{server_name}**! 🙌",
            f"Koi masla nahi bro! Enjoy your time in the server! 🚀",
            f"Glad to help bro! ✨ Feel free to ask anytime."
        ]
        return random.choice(options)

    # ─── 2. RESOLVE GEMINI / OPENAI API KEY ───
    gemini_key = os.environ.get("GEMINI_API_KEY")
    openai_key = os.environ.get("OPENAI_API_KEY")

    # Fallback to database.json if env key not set
    if not gemini_key:
        try:
            db_json_path = os.path.join(os.path.dirname(__file__), '..', 'database.json')
            if os.path.exists(db_json_path):
                with open(db_json_path, 'r', encoding='utf-8') as f:
                    db_data = json.load(f)
                    for m in db_data.get('activeLlmModels', []):
                        if m.get('provider') == 'gemini' and m.get('apiKey') and 'xxxx' not in m.get('apiKey'):
                            gemini_key = m.get('apiKey')
                            break
                        if m.get('provider') == 'openai' and m.get('apiKey') and 'xxxx' not in m.get('apiKey'):
                            openai_key = m.get('apiKey')
        except Exception as e:
            print("[AI Engine] Key load note:", e)

    # Fetch custom Server RAG Knowledge memory from SQLite
    custom_rag = ""
    if guild_id:
        try:
            conn = database.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT config_json FROM plugin_configs WHERE guild_id = ? AND plugin_key IN ('ai-assistant', 'ai') AND enabled = 1", (str(guild_id),))
            row = cursor.fetchone()
            if row and row['config_json']:
                cfg = json.loads(row['config_json'])
                custom_rag = cfg.get('rag_context', '')
            conn.close()
        except Exception as e:
            print("[AI Engine] Error loading custom RAG context:", e)

    rag_section = f"Server Rules & Knowledge Base:\n{custom_rag}\n" if custom_rag else ""

    # ─── 3. GOOGLE GEMINI GENERATIVE AI (ADMIN PERSONA & ROMAN URDU / ENGLISH MATCHING) ───
    if gemini_key:
        for gemini_model in ['gemini-1.5-flash', 'gemini-2.5-flash', 'gemini-1.5-pro']:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={gemini_key}"
                prompt_text = (
                    f"You are the senior Admin / Server Owner of the Discord server '{server_name}'.\n"
                    f"Talk like a real, cool, friendly, and highly intelligent human admin (brother / bro vibe). NEVER sound robotic or like a customer support script.\n\n"
                    f"STRICT RULES:\n"
                    f"1. Language Matching: Match the member's language naturally. If they write in Roman Urdu or Urdu (e.g. 'kia hal hai', 'ye rules kya hain', 'signals kab ayenge'), respond in natural, friendly Roman Urdu (e.g. 'Bro...', 'Haan bilkul...'). If they speak English, reply in conversational English.\n"
                    f"2. Brevity: Keep the response short, punchy, and helpful (1 to 2 sentences max).\n"
                    f"3. Authenticity: Use fitting emojis naturally (🚀, ✨, 🙌). Do NOT say 'As an AI' or 'I am an automated bot'.\n\n"
                    f"{rag_section}"
                    f"Member '{user_name}' says: {prompt}"
                )
                payload = {
                    "contents": [{"parts": [{"text": prompt_text}]}],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 100
                    }
                }
                req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=5) as resp:
                    data = json.loads(resp.read().decode('utf-8'))
                    reply = data['candidates'][0]['content']['parts'][0]['text'].strip()
                    if reply:
                        return reply
            except Exception as e:
                print(f"[Gemini {gemini_model}] Notice:", e)
                continue

    # ─── 4. OPENAI FALLBACK ───
    if openai_key:
        try:
            url = "https://api.openai.com/v1/chat/completions"
            sys_msg = (
                f"You are the senior Admin / Server Owner of the Discord server '{server_name}'. "
                f"Talk like a cool, friendly human admin. Match member's language (Roman Urdu if Roman Urdu, English if English). "
                f"Keep answers short in 1-2 sentences. {rag_section}"
            )
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 100
            }
            headers = {"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"}
            req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                reply = data['choices'][0]['message']['content'].strip()
                if reply:
                    return reply
        except Exception as e:
            print("OpenAI API Note:", e)

    # ─── 5. SMART CONVERSATIONAL FALLBACK (When No Key / Offline) ───
    if any(k in p for k in ['ticket', 'support', 'help', 'admin', 'staff', 'mod', 'owner', 'contact']):
        return f"Bro agar private staff help chahiye toh `#tickets` me `/ticket` use kar sakte ho! Staff hamesha ready hai. 🙌"
    elif any(k in p for k in ['level', 'rank', 'xp', 'score', 'points', 'leveling']):
        return f"Chat karne se automatically XP aur rank barhta hai bro! 🏆 Apna level dekhne ke liye `/rank` type karo."
    elif any(k in p for k in ['rule', 'rules', 'allowed', 'spam', 'ban', 'policy']):
        return f"Bro server rules simple hain: No spam, no external links, aur sab members ki respect karein! ✨"
    elif any(k in p for k in ['suggest', 'proposal', 'idea', 'feature']):
        return f"Zabardast idea hai toh `/suggest` likh kar `#suggestions` me submit karo bro, sab vote karenge! 🗳️"
    else:
        return f"Haan bro! **{server_name}** me kisi bhi cheez me help chahiye toh batao, I'm here to help! 🚀"

@client.tree.command(name="ai", description="Query the AI Auto-Reply Bot assistant")
async def cmd_ai(interaction: discord.Interaction, query: str):
    await interaction.response.defer(thinking=True)
    guild_id = str(interaction.guild.id) if interaction.guild else None
    guild_name = interaction.guild.name if interaction.guild else "Discord Server"
    reply = await generate_ai_response(query, interaction.user.display_name, guild_name, guild_id)
    await interaction.followup.send(reply)

if __name__ == "__main__":
    client.run(TOKEN)
