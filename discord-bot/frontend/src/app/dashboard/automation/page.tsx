'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Workflow, Plus, Trash2, Save, Play, Clock, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function VisualAutomationPage() {
  const { showNotification } = useAppStore();

  const [automations, setAutomations] = useState([
    {
      id: 'auto-1',
      name: 'VIP Welcome & Direct Onboarding',
      enabled: true,
      runCount: 1240,
      trigger: 'MEMBER_JOIN',
      condition: 'Account age > 7 days',
      steps: [
        { type: 'ADD_ROLE', label: 'Assign @Cyber Member Role' },
        { type: 'DELAY', label: 'Wait 10 Seconds' },
        { type: 'SEND_EMBED', label: 'Send Welcome Embed to #general' },
        { type: 'DM_USER', label: 'Send Onboarding DM with Rules' },
      ],
    },
    {
      id: 'auto-2',
      name: 'High Toxicity Auto Escalation',
      enabled: true,
      runCount: 382,
      trigger: 'AUTOMOD_FLAG',
      condition: 'AI Toxicity Score > 0.90',
      steps: [
        { type: 'TIMEOUT_USER', label: 'Timeout User for 60 minutes' },
        { type: 'LOG_MODERATION', label: 'Send Log to #mod-logs' },
        { type: 'NOTIFY_STAFF', label: 'Ping @Senior Moderator Role' },
      ],
    },
  ]);

  const [selectedAuto, setSelectedAuto] = useState(automations[0]);
  const [newStepType, setNewStepType] = useState('SEND_EMBED');

  const handleAddStep = () => {
    const stepLabelMap: Record<string, string> = {
      ADD_ROLE: 'Grant Custom Role to User',
      REMOVE_ROLE: 'Revoke Role from User',
      DELAY: 'Pause Execution for 5 Minutes',
      SEND_EMBED: 'Publish Formatted Rich Embed',
      DM_USER: 'Dispatch Direct Message to User',
      NOTIFY_STAFF: 'Ping Senior Staff Role in Channel',
    };

    const newStep = {
      type: newStepType,
      label: stepLabelMap[newStepType] || 'Custom Action Step',
    };

    const updated = {
      ...selectedAuto,
      steps: [...selectedAuto.steps, newStep],
    };

    setSelectedAuto(updated);
    setAutomations(automations.map((a) => (a.id === updated.id ? updated : a)));
    showNotification('Action step added to workflow!');
  };

  const handleRemoveStep = (index: number) => {
    const updated = {
      ...selectedAuto,
      steps: selectedAuto.steps.filter((_, i) => i !== index),
    };
    setSelectedAuto(updated);
    setAutomations(automations.map((a) => (a.id === updated.id ? updated : a)));
  };

  const handleTestWorkflow = () => {
    showNotification(`Test dry-run executed for "${selectedAuto.name}"! All steps passed.`, 'info');
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Workflow className="w-6 h-6 text-discord-fuchsia" />
            <span>Visual Automation Engine</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Construct event-driven IF/THEN pipelines with zero coding required.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleTestWorkflow}
            className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white transition flex items-center space-x-2 border border-white/10"
          >
            <Play className="w-3.5 h-3.5 text-discord-green" />
            <span>Dry Run Workflow</span>
          </button>
          <button
            onClick={() => showNotification('Automation workflow saved!')}
            className="px-5 py-2.5 rounded-xl font-bold text-xs bg-discord-blurple hover:bg-discord-blurple/90 text-white transition flex items-center space-x-2 shadow-lg shadow-discord-blurple/25"
          >
            <Save className="w-4 h-4" />
            <span>Save Workflow</span>
          </button>
        </div>
      </div>

      {/* Main Builder Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Workflows List Sidebar */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Configured Automations</span>
            <button
              onClick={() => showNotification('Created new automation rule!', 'info')}
              className="p-1 rounded-lg bg-discord-fuchsia/20 text-discord-fuchsia hover:bg-discord-fuchsia/30 transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {automations.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAuto(a)}
                className={`w-full p-3 rounded-xl border text-left transition ${
                  selectedAuto.id === a.id
                    ? 'border-discord-fuchsia bg-discord-fuchsia/15 text-white'
                    : 'border-white/5 glass-panel text-slate-400 hover:text-white'
                }`}
              >
                <div className="text-xs font-bold text-white truncate">{a.name}</div>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                  <span>Trigger: {a.trigger}</span>
                  <span className="text-discord-green font-mono">{a.runCount.toLocaleString()} runs</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Visual Pipeline Canvas */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl border border-white/10 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h3 className="text-base font-bold text-white">{selectedAuto.name}</h3>
              <p className="text-xs text-slate-400 mt-0.5">Edit step sequence and conditional rules.</p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-discord-green/20 text-discord-green text-xs font-mono font-bold">
              ACTIVE
            </span>
          </div>

          {/* Trigger Card (IF) */}
          <div className="p-5 rounded-2xl bg-discord-sidebar border border-discord-blurple/50 relative">
            <span className="text-[10px] font-bold uppercase tracking-wider text-discord-blurple block mb-2">
              IF (Event Trigger)
            </span>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">{selectedAuto.trigger}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{selectedAuto.condition}</p>
              </div>
              <Zap className="w-5 h-5 text-discord-blurple" />
            </div>
          </div>

          {/* Steps Sequence (THEN) */}
          <div className="space-y-4 relative">
            {selectedAuto.steps.map((step, idx) => (
              <React.Fragment key={idx}>
                {/* Arrow Connector */}
                <div className="w-0.5 h-6 bg-white/20 mx-auto" />

                <div className="p-4 rounded-xl glass-panel border border-white/10 flex items-center justify-between group hover:border-discord-fuchsia/40 transition">
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-discord-fuchsia/20 text-discord-fuchsia text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-xs font-mono text-discord-fuchsia uppercase font-bold">{step.type}</span>
                      <p className="text-xs font-bold text-white">{step.label}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveStep(idx)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Add Action Controls */}
          <div className="pt-4 border-t border-white/10 flex gap-3">
            <select
              value={newStepType}
              onChange={(e) => setNewStepType(e.target.value)}
              className="flex-1 bg-discord-card border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-discord-blurple"
            >
              <option value="ADD_ROLE">THEN: Assign Custom Role</option>
              <option value="REMOVE_ROLE">THEN: Revoke Custom Role</option>
              <option value="DELAY">THEN: Add Delay Pause</option>
              <option value="SEND_EMBED">THEN: Send Embed Message</option>
              <option value="DM_USER">THEN: Send DM to User</option>
              <option value="NOTIFY_STAFF">THEN: Alert Staff Role</option>
            </select>

            <button
              onClick={handleAddStep}
              className="px-4 py-2 bg-discord-fuchsia hover:bg-discord-fuchsia/90 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Action Step</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
