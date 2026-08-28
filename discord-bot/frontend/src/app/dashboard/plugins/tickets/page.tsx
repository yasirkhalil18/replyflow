'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Ticket, Save, ArrowLeft, Plus, Trash2, FileText, CheckCircle2, UserCheck, MessageSquare, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function TicketPluginPage() {
  const { showNotification } = useAppStore();

  const [panelTitle, setPanelTitle] = useState('Cyberpunk Support Hub & Inquiries');
  const [panelDescription, setPanelDescription] = useState('Select your inquiry category below to open a private ticket channel with staff.');
  const [departments, setDepartments] = useState(['Technical Support', 'Billing & Subscriptions', 'Report User', 'Partnerships']);
  const [newDep, setNewDep] = useState('');
  const [activeTicketTab, setActiveTicketTab] = useState<'config' | 'tickets' | 'closed' | 'transcript'>('tickets');
  const [selectedTranscriptTicket, setSelectedTranscriptTicket] = useState<string>('TKT-1047');

  const [activeTickets, setActiveTickets] = useState([
    { id: 'TKT-1049', user: 'NeonViper#0091', dept: 'Billing & Subscriptions', status: 'OPEN', staff: 'Unassigned', time: '10m ago' },
    { id: 'TKT-1048', user: 'GlitchMaster#1337', dept: 'Report User', status: 'CLAIMED', staff: 'AdminAlex', time: '1h ago' },
  ]);

  const [closedTickets, setClosedTickets] = useState([
    { id: 'TKT-1047', user: 'SynthWave#4040', dept: 'Technical Support', status: 'CLOSED', closedBy: 'Admin (ModSarah)', closedRole: 'admin', time: '3h ago' },
    { id: 'TKT-1046', user: 'CyberPawn#9901', dept: 'General Inquiry', status: 'CLOSED', closedBy: 'User (CyberPawn)', closedRole: 'person', time: '1d ago' },
  ]);

  const handleCloseTicket = (ticketId: string, closedByRole: 'admin' | 'person') => {
    const ticketToClose = activeTickets.find(t => t.id === ticketId);
    if (!ticketToClose) return;

    const closerLabel = closedByRole === 'admin' ? 'Admin (Staff)' : `Person (${ticketToClose.user})`;

    const updatedClosed = [
      {
        ...ticketToClose,
        status: 'CLOSED',
        closedBy: closerLabel,
        closedRole: closedByRole,
        time: 'Just now'
      },
      ...closedTickets
    ];

    setActiveTickets(activeTickets.filter(t => t.id !== ticketId));
    setClosedTickets(updatedClosed);

    showNotification(`Ticket ${ticketId} closed by ${closedByRole === 'admin' ? 'Admin' : 'Person (User)'}!`, 'success');
  };

  const handleReopenTicket = (ticketId: string) => {
    const ticketToReopen = closedTickets.find(t => t.id === ticketId);
    if (!ticketToReopen) return;

    setActiveTickets([
      ...activeTickets,
      {
        id: ticketToReopen.id,
        user: ticketToReopen.user,
        dept: ticketToReopen.dept,
        status: 'OPEN',
        staff: 'Unassigned',
        time: 'Reopened'
      }
    ]);

    setClosedTickets(closedTickets.filter(t => t.id !== ticketId));
    showNotification(`Ticket ${ticketId} reopened!`, 'info');
  };

  const handleAddDepartment = () => {
    if (!newDep.trim()) return;
    setDepartments([...departments, newDep.trim()]);
    setNewDep('');
    showNotification('Department added!');
  };

  const handleRemoveDepartment = (index: number) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link href="/dashboard/plugins" className="p-2 rounded-xl glass-panel hover:bg-white/10 text-slate-400 hover:text-white transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
              <Ticket className="w-6 h-6 text-discord-fuchsia" />
              <span>Ticket System Hub</span>
            </h1>
            <p className="text-slate-400 text-xs mt-0.5">Manage tickets with dual close options for Admins and Persons (Users), plus auto-transcripts.</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTicketTab('config')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              activeTicketTab === 'config' ? 'bg-discord-blurple text-white border-discord-blurple shadow-md shadow-discord-blurple/30' : 'glass-panel text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            Panel Settings
          </button>
          <button
            onClick={() => setActiveTicketTab('tickets')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              activeTicketTab === 'tickets' ? 'bg-discord-blurple text-white border-discord-blurple shadow-md shadow-discord-blurple/30' : 'glass-panel text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            Active Tickets ({activeTickets.length})
          </button>
          <button
            onClick={() => setActiveTicketTab('closed')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition border ${
              activeTicketTab === 'closed' ? 'bg-discord-blurple text-white border-discord-blurple shadow-md shadow-discord-blurple/30' : 'glass-panel text-slate-400 border-white/10 hover:text-white'
            }`}
          >
            Closed Tickets ({closedTickets.length})
          </button>
        </div>
      </div>

      {activeTicketTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel Form Settings */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
            <h3 className="text-base font-bold text-white pb-3 border-b border-white/10">Panel Customization</h3>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Panel Embed Title</label>
                <input
                  type="text"
                  value={panelTitle}
                  onChange={(e) => setPanelTitle(e.target.value)}
                  className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-discord-blurple"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Panel Embed Description</label>
                <textarea
                  rows={3}
                  value={panelDescription}
                  onChange={(e) => setPanelDescription(e.target.value)}
                  className="w-full bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Department Categories</label>
                <div className="space-y-2 mb-3">
                  {departments.map((dep, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-discord-card rounded-xl border border-white/10 text-xs text-white">
                      <span>{dep}</span>
                      <button onClick={() => handleRemoveDepartment(idx)} className="text-slate-500 hover:text-rose-400 transition">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New department name..."
                    value={newDep}
                    onChange={(e) => setNewDep(e.target.value)}
                    className="flex-1 bg-discord-card border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
                  />
                  <button
                    onClick={handleAddDepartment}
                    className="px-4 py-2 bg-discord-fuchsia hover:bg-discord-fuchsia/90 text-white rounded-xl text-xs font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Discord Embed Preview */}
          <div className="glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 block">
              Discord Embed Panel Live Preview
            </span>

            <div className="bg-[#2b2d31] p-5 rounded-xl border-l-4 border-discord-blurple space-y-4">
              <div className="text-sm font-bold text-white">{panelTitle}</div>
              <div className="text-xs text-slate-300 leading-relaxed">{panelDescription}</div>

              {/* Department Dropdown Preview */}
              <div className="pt-2">
                <select className="w-full bg-[#1e1f22] border border-white/10 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none">
                  <option value="">Select a department to open ticket...</option>
                  {departments.map((d, i) => (
                    <option key={i} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 mt-6 text-center">
              Clicking a department in Discord will automatically create a private thread/channel where both the member (person) and staff (admin) can close the ticket.
            </p>
          </div>
        </div>
      )}

      {activeTicketTab === 'tickets' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">Active Guild Support Tickets</h3>
              <p className="text-xs text-slate-400">Tickets can be closed by both Admin and Person (ticket owner).</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-discord-blurple/20 text-discord-blurple border border-discord-blurple/30">
              {activeTickets.length} Open
            </span>
          </div>

          {activeTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No open tickets currently active.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {activeTickets.map((t) => (
                <div key={t.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-discord-blurple">{t.id}</span>
                      <span className="text-xs font-bold text-white">{t.user}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">{t.dept}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-3">
                      <span>Opened {t.time}</span>
                      <span>•</span>
                      <span>Assigned Staff: <strong className="text-white">{t.staff}</strong></span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleCloseTicket(t.id, 'admin')}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold transition flex items-center space-x-1"
                      title="Close ticket as Administrator"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Close (Admin)</span>
                    </button>
                    <button
                      onClick={() => handleCloseTicket(t.id, 'person')}
                      className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center space-x-1"
                      title="Close ticket as Person/User"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Close (Person)</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTranscriptTicket(t.id);
                        setActiveTicketTab('transcript');
                        showNotification('Loaded transcript for ' + t.id, 'info');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition flex items-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Transcript</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTicketTab === 'closed' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">Closed Tickets History</h3>
              <p className="text-xs text-slate-400">Archived tickets closed by Admins or Persons.</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/10 text-slate-300 border border-white/10">
              {closedTickets.length} Closed
            </span>
          </div>

          {closedTickets.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No closed tickets found in history.</div>
          ) : (
            <div className="divide-y divide-white/10">
              {closedTickets.map((t) => (
                <div key={t.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-3">
                      <span className="font-mono text-xs font-bold text-slate-400">{t.id}</span>
                      <span className="text-xs font-bold text-white">{t.user}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-slate-300 font-mono">{t.dept}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        t.closedRole === 'admin' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        Closed by {t.closedRole === 'admin' ? 'Admin' : 'Person'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center space-x-3">
                      <span>Closed {t.time}</span>
                      <span>•</span>
                      <span>Closer Details: <strong className="text-slate-200">{t.closedBy}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleReopenTicket(t.id)}
                      className="px-3 py-1.5 rounded-xl bg-discord-blurple/20 hover:bg-discord-blurple/30 text-discord-blurple border border-discord-blurple/30 text-xs font-bold transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Reopen</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTranscriptTicket(t.id);
                        setActiveTicketTab('transcript');
                        showNotification('Loaded transcript for ' + t.id, 'info');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition flex items-center space-x-1"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>View Transcript</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTicketTab === 'transcript' && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">HTML Auto-Transcript Viewer</h3>
              <p className="text-xs text-slate-400">Ticket #{selectedTranscriptTicket} • Transcript Archive</p>
            </div>
            <button onClick={() => setActiveTicketTab('closed')} className="text-xs font-bold text-discord-blurple hover:underline">
              Back to Closed Tickets
            </button>
          </div>

          <div className="bg-[#1e1f22] p-6 rounded-xl space-y-4 text-xs font-sans border border-white/10">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-discord-blurple flex items-center justify-center font-bold text-white">SW</div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-white">SynthWave#4040 (Person)</span>
                  <span className="text-[10px] text-slate-500">14:02 PM</span>
                </div>
                <p className="text-slate-300 mt-0.5">Hi! I bought the Pro plan subscription but my role hasn't updated yet.</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 rounded-full bg-discord-green flex items-center justify-center font-bold text-white">MS</div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-discord-green">ModSarah [Admin/Staff]</span>
                  <span className="text-[10px] text-slate-500">14:04 PM</span>
                </div>
                <p className="text-slate-300 mt-0.5">Hey SynthWave! I verified your Stripe ID in the billing portal. I have synced your Pro roles now!</p>
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-lg border border-white/10 text-slate-400 text-[11px] font-mono">
              🔒 Ticket #{selectedTranscriptTicket} was closed and archived with full transcript saved to audit logs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

