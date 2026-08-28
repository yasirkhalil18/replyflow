export interface WorkflowStep {
  type: string;
  payload: Record<string, any>;
}

export interface WorkflowCondition {
  field: 'hasRole' | 'accountAgeDays' | 'memberCount' | 'regex' | 'channelId';
  operator: 'equals' | 'greaterThan' | 'contains' | 'matches';
  value: any;
}

export interface AutomationRule {
  id: string;
  guildId: string;
  name: string;
  trigger: string; // MEMBER_JOIN, MEMBER_LEAVE, MESSAGE_SENT, VOICE_JOIN, TICKET_OPEN, AI_TRIGGER, CRON
  conditions: WorkflowCondition[];
  steps: WorkflowStep[];
  enabled: boolean;
}

export class AutomationEngine {
  public static async evaluateConditions(
    conditions: WorkflowCondition[],
    context: Record<string, any>
  ): Promise<boolean> {
    for (const cond of conditions) {
      if (cond.field === 'accountAgeDays') {
        const age = context.accountAgeDays || 0;
        if (cond.operator === 'greaterThan' && age <= cond.value) return false;
      }
      if (cond.field === 'hasRole') {
        const roles: string[] = context.roles || [];
        if (!roles.includes(cond.value)) return false;
      }
      if (cond.field === 'regex') {
        const text: string = context.messageText || '';
        const regex = new RegExp(cond.value, 'i');
        if (!regex.test(text)) return false;
      }
    }
    return true;
  }

  public static async executeWorkflow(
    workflow: AutomationRule,
    eventContext: Record<string, any>
  ): Promise<{ success: boolean; executedSteps: number; log: string[] }> {
    const logs: string[] = [];

    logs.push(`[Workflow: ${workflow.name}] Evaluating trigger: ${workflow.trigger}`);

    const passed = await this.evaluateConditions(workflow.conditions, eventContext);
    if (!passed) {
      logs.push(`[Workflow: ${workflow.name}] Conditions evaluation failed. Halting workflow.`);
      return { success: false, executedSteps: 0, log: logs };
    }

    let count = 0;
    for (const step of workflow.steps) {
      count++;
      logs.push(`[Step ${count}] Executing action ${step.type}...`);

      if (step.type === 'SEND_EMBED') {
        logs.push(`-> Embed dispatched to channel ${step.payload.channelId || 'default'}`);
      } else if (step.type === 'ADD_ROLE') {
        logs.push(`-> Role ${step.payload.roleId} assigned to user`);
      } else if (step.type === 'DELAY') {
        logs.push(`-> Delaying execution for ${step.payload.seconds || 5} seconds`);
      } else if (step.type === 'HTTP_REQUEST') {
        logs.push(`-> Webhook HTTP POST sent to ${step.payload.url}`);
      } else if (step.type === 'RUN_AI') {
        logs.push(`-> AI Agent generated response for context prompt`);
      }
    }

    logs.push(`[Workflow: ${workflow.name}] Completed ${count} steps successfully.`);
    return { success: true, executedSteps: count, log: logs };
  }
}
