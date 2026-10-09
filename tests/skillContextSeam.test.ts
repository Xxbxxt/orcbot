import { describe, expect, it } from 'vitest';
import { SkillsManager } from '../src/core/SkillsManager';
import { registerMemorySkills } from '../src/skills/memoryTools';

/**
 * The migrated skills cross the same seam a test does: a small stub SkillContext, no agent.
 * If any of these ever needs an Agent to run, the seam has stopped being a seam.
 */

const baseCtx = () => ({
    memory: {} as any,
    config: {
        get: () => undefined,
        getAll: () => ({}),
        set: () => undefined,
        getDataHome: () => '/tmp',
    } as any,
    actionQueue: {} as any,
});

function managerFor(ctx: any) {
    const manager = new SkillsManager(undefined as any, undefined, () => ctx);
    registerMemorySkills(manager);
    return manager;
}

describe('migrated skills run against a stub SkillContext', () => {
    it('exposes the whole slice through the registry seam', () => {
        const manager = managerFor(baseCtx());
        for (const name of ['get_contact_profile', 'recall_memory', 'search_memory_logs',
            'list_memory_logs', 'read_memory_log', 'update_user_profile', 'await_subtask',
            'run_subtask']) {
            expect(manager.getSkill(name), name).toBeTruthy();
        }
    });

    it('get_contact_profile reads only ctx.memory', async () => {
        const seen: string[] = [];
        const ctx = baseCtx();
        ctx.memory = { getContactProfile: (jid: string) => { seen.push(jid); return 'likes tea'; } };

        const out = await managerFor(ctx).executeSkill('get_contact_profile', { jid: 'a@b' });

        expect(seen).toEqual(['a@b']);
        expect(String(out)).toContain('likes tea');
    });

    it('list_memory_logs needs no args and reaches ctx.memory alone', async () => {
        const ctx = baseCtx();
        ctx.memory = {
            getDailyMemory: () => ({
                listDailyMemories: () => ['2026-10-09', '2026-10-08'],
                getStats: () => ({ memoryDir: '/mem' }),
            }),
        };

        const out = await managerFor(ctx).executeSkill('list_memory_logs', {});

        expect(String(out)).toContain('2026-10-09');
        expect(String(out)).toContain('/mem');
    });

    it('run_subtask uses ctx.actionQueue and ctx.memory, not an agent', async () => {
        const pushed: any[] = [];
        const ctx = baseCtx();
        ctx.actionQueue = {
            push: (a: any) => { pushed.push(a); },
            getAction: () => ({ id: 'x', status: 'completed' }),
        };
        ctx.memory = { getMemory: () => ({ content: 'the subtask finished' }) };

        const out = await managerFor(ctx).executeSkill('run_subtask', { description: 'summarise the logs' });

        expect(pushed).toHaveLength(1);
        expect(pushed[0].payload.description).toBe('summarise the logs');
        expect(String(out)).toContain('the subtask finished');
    });
});
