import { EventEmitter } from 'eventemitter3';

/**
 * Universal Event Bus for OrcBot
 * 
 * Provides a central hub for real-time events across the agent,
 * including LLM streaming, tool execution, and task progress.
 */
export type OrcBotEvent = 
    | 'llm:token'        // A single character/token from an LLM
    | 'llm:thought'      // A character/token from a model's internal reasoning (e.g. Claude Thinking)
    | 'llm:start'        // LLM has started generating a response
    | 'llm:end'          // LLM has finished generation
    | 'tool:call'        // A tool is about to be invoked
    | 'tool:result'      // A tool has finished execution
    | 'task:step:start'  // A new step in the decision plan has started
    | 'task:progress'    // General progress update (0-100)
    | 'task:complete'    // Entire task action is finished
    | 'channel:registered'
    | 'channel:removed'
    | 'whatsapp:config-changed'
    | 'whatsapp:qr'
    | 'whatsapp:status'
    | 'config:changed'
    | 'gateway:chat:response'
    | 'gateway:chat:file'
    | 'gateway:chat:canvas'
    | 'scheduler:tick'
    | 'action:queued'
    | 'action:push'
    | 'agentic-user:intervention'
    | 'user:activity'
    | 'polling:started'
    | 'polling:stopped'
    | 'polling:progress'
    | 'polling:success'
    | 'polling:failure'
    | 'polling:error'
    | 'polling:registered'
    | 'polling:cancelled'
    | (string & {});      // Fallback for any other event string to prevent breaking existing code

export class EventBus extends EventEmitter<OrcBotEvent> {
    private static instance: EventBus;

    private constructor() {
        super();
    }

    public static getInstance(): EventBus {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }

    /**
     * Helper to emit tokens with metadata
     */
    public emitToken(token: string, metadata: { actionId?: string, model: string, provider: string }) {
        this.emit('llm:token', { token, ...metadata } as any);
    }

    /**
     * Helper to emit thoughts with metadata
     */
    public emitThought(thought: string, metadata: { actionId?: string, model: string, provider: string }) {
        this.emit('llm:thought', { thought, ...metadata } as any);
    }
}

export const eventBus = EventBus.getInstance();
