import type { Skill, SkillContext, SkillRegistry } from '../core/SkillsManager';
import fs from 'fs';
import { DailyMemory } from '../memory/DailyMemory';
import { logger } from '../utils/logger';
import { getOrcBotDataHome } from '../utils/dataHome';
import path from 'path';
import os from 'os';

/**
 * Memory tools for searching and retrieving markdown-based memory files.
 * Inspired by OpenClaw's memory system with memory_search and memory_get tools.
 */

/**
 * Simple text-based search across memory files
 * Returns snippets with context for matching queries
 */
export async function memorySearchSkill(args: any, context: any): Promise<string> {
    try {
        const query = args.query || '';
        if (!query) {
            return 'Error: No search query provided. Use: memory_search query="your search term"';
        }

        const memoryManager = context?.agent?.memory;
        const dataHome = memoryManager?.dataHome || context?.config?.getDataHome?.() || getOrcBotDataHome();
        const dailyMemory = memoryManager?.getDailyMemory() || new DailyMemory(dataHome);
        
        const results: Array<{
            file: string;
            snippet: string;
            score: number;
            type: 'semantic' | 'keyword';
        }> = [];

        // 1. Semantic Recall (if vector memory is enabled)
        if (memoryManager?.vectorMemory?.isEnabled()) {
            try {
                const semanticHits = await memoryManager.semanticRecall(query, 5);
                for (const hit of semanticHits) {
                    results.push({
                        file: hit.metadata?.source || 'vector-memory',
                        snippet: `[Semantic Match] ${hit.content}`,
                        score: hit.score * 2, // Boost semantic relevance
                        type: 'semantic'
                    });
                }
            } catch (e) {
                logger.warn(`Memory search: Semantic recall failed: ${e}`);
            }
        }

        // 2. Keyword Search (Precision matching in Markdown files)
        // Search in long-term memory
        const longTerm = dailyMemory.readLongTerm();
        if (longTerm) {
            const matches = findMatches(longTerm, query, 'MEMORY.md');
            results.push(...matches.map(m => ({ ...m, type: 'keyword' as const })));
        }

        // Search in recent daily memories (last 7 days)
        const dailyFiles = dailyMemory.listDailyMemories().slice(0, 7);
        for (const fileName of dailyFiles) {
            const content = dailyMemory.readDailyMemory(fileName.replace('.md', ''));
            if (content) {
                const matches = findMatches(content, query, `memory/${fileName}`);
                results.push(...matches.map(m => ({ ...m, type: 'keyword' as const })));
            }
        }

        // Sort by score (descending)
        results.sort((a, b) => b.score - a.score);

        // Deduplicate results with similar snippets
        const uniqueResults: typeof results = [];
        const seenSnippets = new Set<string>();
        for (const r of results) {
            const normalized = r.snippet.toLowerCase().replace(/\W/g, '').slice(0, 100);
            if (!seenSnippets.has(normalized)) {
                seenSnippets.add(normalized);
                uniqueResults.push(r);
            }
        }

        // Return top 8 results
        const topResults = uniqueResults.slice(0, 8);
        
        if (topResults.length === 0) {
            return `No matches found for query: "${query}"`;
        }

        const output = [
            `Found ${topResults.length} result(s) for query: "${query}" (Hybrid Search: Semantic + Keyword)\n`,
            ...topResults.map((r, i) => 
                `${i + 1}. **${r.file}** (score: ${r.score.toFixed(2)}, type: ${r.type})\n${r.snippet}\n`
            )
        ].join('\n');

        return output;
    } catch (error) {
        logger.error(`Memory search error: ${error}`);
        return `Error searching memory: ${error}`;
    }
}

/**
 * Retrieve the full content of a specific memory file
 */
export async function memoryGetSkill(args: any, context: any): Promise<string> {
    try {
        const filePath = args.path || args.file || '';
        if (!filePath) {
            return 'Error: No file path provided. Use: memory_get path="MEMORY.md" or path="memory/2024-01-15.md"';
        }

        const memoryManager = context?.agent?.memory;
        const dataHome = memoryManager?.dataHome || context?.config?.getDataHome?.() || getOrcBotDataHome();
        const dailyMemory = memoryManager?.getDailyMemory() || new DailyMemory(dataHome);
        
        // Handle different file path formats
        let content: string | null = null;
        
        if (filePath === 'MEMORY.md' || filePath === 'long-term') {
            content = dailyMemory.readLongTerm();
        } else if (filePath === 'today') {
            content = dailyMemory.readToday();
        } else if (filePath === 'yesterday') {
            content = dailyMemory.readYesterday();
        } else if (filePath.startsWith('memory/') || /^\d{4}-\d{2}-\d{2}(\.md)?$/.test(filePath)) {
            // Extract date from path
            const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                content = dailyMemory.readDailyMemory(dateMatch[1]);
            }
        }

        if (!content) {
            return `Error: Memory file not found: ${filePath}\n\nAvailable files:\n- MEMORY.md (long-term)\n- today\n- yesterday\n- memory/YYYY-MM-DD.md`;
        }

        // Optionally limit content length
        const maxLength = args.maxLength || 10000;
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + `\n\n... (truncated, ${content.length - maxLength} more characters)`;
        }

        return `# Content of ${filePath}\n\n${content}`;
    } catch (error) {
        logger.error(`Memory get error: ${error}`);
        return `Error retrieving memory: ${error}`;
    }
}

/**
 * Write a memory entry to daily log or long-term memory
 */
export async function memoryWriteSkill(args: any, context: any): Promise<string> {
    try {
        const content = args.content || args.text || '';
        const type = args.type || 'daily'; // 'daily' or 'long-term'
        const category = args.category || args.section;

        if (!content) {
            return 'Error: No content provided. Use: memory_write content="text to remember" type="daily|long-term"';
        }

        const memoryManager = context?.agent?.memory;
        const dataHome = memoryManager?.dataHome || context?.config?.getDataHome?.() || getOrcBotDataHome();
        const dailyMemory = memoryManager?.getDailyMemory() || new DailyMemory(dataHome);

        if (type === 'long-term' || type === 'longterm') {
            dailyMemory.appendToLongTerm(content, category);
            
            // Queue for vector memory as well
            if (memoryManager) {
                memoryManager.saveMemory({
                    id: `manual-long-${Date.now()}`,
                    type: 'long',
                    content,
                    metadata: { category, source: 'memory_write_skill' }
                });
            }
            
            return `✓ Written to long-term memory (MEMORY.md)${category ? ` under section: ${category}` : ''}`;
        } else {
            dailyMemory.appendToDaily(content, category);
            
            // Queue for vector memory as well
            if (memoryManager) {
                memoryManager.saveMemory({
                    id: `manual-daily-${Date.now()}`,
                    type: 'short',
                    content,
                    metadata: { category, source: 'memory_write_skill' }
                });
            }
            
            return `✓ Written to today's daily log${category ? ` (category: ${category})` : ''}`;
        }
    } catch (error) {
        logger.error(`Memory write error: ${error}`);
        return `Error writing to memory: ${error}`;
    }
}

/**
 * Get memory statistics and available files
 */
export async function memoryStatsSkill(args: any, context: any): Promise<string> {
    try {
        const memoryManager = context?.agent?.memory;
        const dataHome = memoryManager?.dataHome || context?.config?.getDataHome?.() || getOrcBotDataHome();
        const dailyMemory = memoryManager?.getDailyMemory() || new DailyMemory(dataHome);
        const stats = dailyMemory.getStats();
        const recentFiles = dailyMemory.listDailyMemories().slice(0, 10);

        const vectorStats = memoryManager?.vectorMemory?.getStats() || { indexed: 0, pending: 0, provider: 'none', dimensions: 0 };

        const output = [
            '# Memory System Statistics\n',
            `**Memory Directory:** ${stats.memoryDir}`,
            `**Long-term Memory:** ${stats.hasLongTerm ? '✓ exists' : '✗ not created'}`,
            `**Daily Memory Files:** ${stats.dailyFiles}`,
            `**Vector Memory:** ${memoryManager?.vectorMemory?.isEnabled() ? '✓ enabled' : '✗ disabled'}`,
            `  - Provider: ${vectorStats.provider}`,
            `  - Indexed: ${vectorStats.indexed}`,
            `  - Pending: ${vectorStats.pending}\n`,
            '## Recent Daily Logs:',
            ...recentFiles.map(f => `- ${f}`),
            '\n**Available commands:**',
            '- `memory_search query="search term"` - Search across all memory (Hybrid)',
            '- `memory_get path="MEMORY.md"` - Read a specific file',
            '- `memory_write content="text" type="daily|long-term"` - Write to memory',
            '- `memory_stats` - Show this information'
        ].join('\n');

        return output;
    } catch (error) {
        logger.error(`Memory stats error: ${error}`);
        return `Error getting memory stats: ${error}`;
    }
}

/**
 * Helper function to find text matches in content
 */
function findMatches(content: string, query: string, fileName: string): Array<{
    file: string;
    snippet: string;
    score: number;
}> {
    const results: Array<{ file: string; snippet: string; score: number }> = [];
    const lines = content.split('\n');
    const queryLower = query.toLowerCase();
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineLower = line.toLowerCase();
        
        if (lineLower.includes(queryLower)) {
            // Calculate a simple relevance score
            const exactMatch = line.includes(query) ? 2 : 1;
            const lengthBonus = 1 / (Math.max(line.length, 1) / 100); // Prefer shorter, focused lines
            const score = exactMatch + lengthBonus;
            
            // Get context (2 lines before and after)
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            const context = lines.slice(start, end);
            
            // Highlight the match - ensure we're highlighting the correct line
            const highlightedContext = context.map((l, idx) => {
                const actualLineIdx = start + idx;
                if (actualLineIdx === i) {
                    return `**>>> ${l}**`; // Highlight matched line
                }
                return `    ${l}`;
            });
            
            results.push({
                file: fileName,
                snippet: highlightedContext.join('\n'),
                score
            });
        }
    }
    
    return results;
}

// Export skill definitions
export const memoryToolsSkills = [
    {
        name: 'memory_search',
        description: 'Search across all memory files (daily logs and long-term memory) for relevant information. Returns snippets with context.',
        usage: 'memory_search query="search term"',
        handler: memorySearchSkill
    },
    {
        name: 'memory_get',
        description: 'Retrieve the full content of a specific memory file. Supports: MEMORY.md, today, yesterday, or memory/YYYY-MM-DD.md',
        usage: 'memory_get path="MEMORY.md"',
        handler: memoryGetSkill
    },
    {
        name: 'memory_write',
        description: 'Write a memory entry to daily log or long-term memory. Use type="daily" for day-to-day notes, type="long-term" for durable facts.',
        usage: 'memory_write content="information to remember" type="daily" category="optional category"',
        handler: memoryWriteSkill
    },
    {
        name: 'memory_stats',
        description: 'Get statistics about the memory system, including available files and storage locations.',
        usage: 'memory_stats',
        handler: memoryStatsSkill
    }
];

/**
 * Skills migrated onto the narrow SkillContext seam. Each depends only on ctx.memory,
 * ctx.config and ctx.actionQueue, so none closes over the agent and each is testable by
 * passing a small stub context.
 */
export const memoryContextSkills: Skill[] = [
    {
                name: 'update_contact_profile',
                description: 'Update the autonomous profile/memory of a specific WhatsApp contact. Use this to store traits, facts, and relationship context.',
                usage: 'update_contact_profile(jid, profile_json)',
                handler: async (args: any, ctx: SkillContext) => {
                    const jid = args.jid || args.to;
                    const profileJson = args.profile_json || args.profile || args.content;

                    if (!jid) return 'Error: Missing jid.';
                    if (!profileJson) return 'Error: Missing profile_json.';

                    try {
                        // Validate JSON if it's a string, or just save it
                        const data = typeof profileJson === 'string' ? profileJson : JSON.stringify(profileJson, null, 2);
                        ctx.memory.saveContactProfile(jid, data);
                        return `Profile for ${jid} updated successfully.`;
                    } catch (e) {
                        return `Error updating profile: ${e}`;
                    }
                }
            },
    {
                name: 'get_contact_profile',
                description: 'Retrieve the stored profile/context for a specific WhatsApp contact.',
                usage: 'get_contact_profile(jid)',
                isParallelSafe: true,
                handler: async (args: any, ctx: SkillContext) => {
                    const jid = args.jid || args.to || args.id;

                    if (!jid) return 'Error: Missing jid.';

                    try {
                        const profile = ctx.memory.getContactProfile(jid);
                        if (!profile) {
                            return `No profile found for ${jid}. You can create one using 'update_contact_profile'.`;
                        }
                        return `Profile for ${jid}:\n${profile}`;
                    } catch (e) {
                        return `Error retrieving profile: ${e}`;
                    }
                }
            },
    {
                name: 'list_whatsapp_contacts',
                description: 'List recent WhatsApp contacts that have interacted with the bot. Returns contact JIDs from recent memory.',
                usage: 'list_whatsapp_contacts(limit?)',
                handler: async (args: any, ctx: SkillContext) => {
                    const limit = parseInt(args.limit || '20', 10);

                    try {
                        // Get recent WhatsApp messages from memory
                        const memories = ctx.memory.searchMemory('short');
                        const whatsappMessages = memories.filter((m: any) =>
                            m.metadata?.source === 'whatsapp' &&
                            m.metadata?.senderId &&
                            m.metadata?.senderId !== 'status@broadcast'
                        );

                        // Extract unique contacts with their last interaction
                        const contactMap = new Map<string, { jid: string; name: string; lastMessage: string; timestamp: string }>();

                        for (const msg of whatsappMessages) {
                            const jid = msg.metadata.senderId;
                            const name = msg.metadata.senderName || jid;
                            if (!contactMap.has(jid)) {
                                contactMap.set(jid, {
                                    jid,
                                    name,
                                    lastMessage: msg.content.substring(0, 100),
                                    timestamp: msg.timestamp
                                });
                            }
                        }

                        const contacts = Array.from(contactMap.values())
                            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                            .slice(0, limit);

                        if (contacts.length === 0) {
                            return 'No recent WhatsApp contacts found in memory.';
                        }

                        const formatted = contacts.map((c, i) =>
                            `${i + 1}. ${c.name} (${c.jid})\n   Last: ${c.lastMessage.substring(0, 60)}...\n   Time: ${c.timestamp}`
                        ).join('\n\n');

                        return `Recent WhatsApp Contacts (${contacts.length}):\n\n${formatted}`;
                    } catch (e) {
                        return `Error listing contacts: ${e}`;
                    }
                }
            },
    {
                name: 'search_chat_history',
                description: 'Search chat history with a specific contact. Supports semantic search (meaning-based) when vector memory is enabled, falling back to keyword/recency search across ALL memories (short and episodic). Works across WhatsApp, Telegram, and Discord.',
                usage: 'search_chat_history(jid, query?, limit?, source?)',
                handler: async (args: any, ctx: SkillContext) => {
                    const jid = args.jid || args.to || args.id;
                    const query = args.query || args.search || args.q || '';
                    const limit = parseInt(args.limit || '10', 10);
                    const source = args.source || 'whatsapp'; // Default to whatsapp for backward compat

                    if (!jid) return 'Error: Missing jid/contact identifier.';

                    try {
                        // 1. Try semantic search with metadata filtering first (highest precision)
                        if (query && ctx.memory.vectorMemory?.isEnabled()) {
                            // Search for the query, but allow any field to match the jid
                            // We use limit*3 and post-filter because jid might be in senderId OR chatId OR sourceId
                            const semanticHits = await ctx.memory.semanticSearch(query, limit * 3, { source });
                            const contactHits = semanticHits.filter((h: any) => {
                                const md = h.metadata || {};
                                return md.senderId === jid || md.sourceId === jid || md.chatId === jid || md.userId === jid;
                            }).slice(0, limit);

                            if (contactHits.length > 0) {
                                const formatted = contactHits.map((m: any, i: number) =>
                                    `[${m.timestamp}] (relevance: ${(m.score * 100).toFixed(0)}%) ${m.content}`
                                ).join('\n\n');
                                return `Found ${contactHits.length} relevant messages for ${jid} via semantic search:\n\n${formatted}`;
                            }
                        }

                        // 2. Fallback: search ALL memory types (short + episodic) for keywords + jid
                        const queryLower = query.toLowerCase();
                        const allMemories = [
                            ...ctx.memory.searchMemory('short'),
                            ...ctx.memory.searchMemory('episodic'),
                        ];

                        const chatHistory = allMemories.filter((m: any) => {
                            const md = m.metadata || {};
                            // Match source/platform
                            if (md.source !== source) return false;
                            // Match contact JID across possible fields
                            const isMatchJid = md.senderId === jid || md.sourceId === jid || md.chatId === jid || md.userId === jid;
                            if (!isMatchJid) return false;
                            // Match query if provided
                            if (queryLower && !(m.content || '').toLowerCase().includes(queryLower)) return false;
                            return true;
                        });

                        // Sort by timestamp (most recent first)
                        const sortedHistory = chatHistory.sort((a, b) => {
                            const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                            const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                            return tb - ta;
                        }).slice(0, limit);

                        if (sortedHistory.length === 0) {
                            return `No chat history found for ${jid}${query ? ` matching "${query}"` : ''} on ${source}. Note: older history might be in Daily Memory files or episodic summaries.`;
                        }

                        const formatted = sortedHistory.map((m: any, i: number) =>
                            `[${m.timestamp}] (${m.type}) ${m.content}`
                        ).join('\n\n').slice(0, 15000); // Prevent wall of text

                        return `Found ${sortedHistory.length} messages for ${jid} on ${source}:\n\n${formatted}`;
                    } catch (e) {
                        return `Error searching chat history: ${e}`;
                    }
                }
            },
    {
                name: 'get_whatsapp_context',
                description: 'Get comprehensive context about a WhatsApp contact including their profile, recent chat history, and relationship notes.',
                usage: 'get_whatsapp_context(jid)',
                handler: async (args: any, ctx: SkillContext) => {
                    const jid = args.jid || args.to || args.id;

                    if (!jid) return 'Error: Missing jid.';

                    try {
                        // Get profile
                        const profile = ctx.memory.getContactProfile(jid);

                        // Get recent chat history
                        const memories = ctx.memory.searchMemory('short');
                        const chatHistory = memories
                            .filter((m: any) =>
                                m.metadata?.source === 'whatsapp' &&
                                m.metadata?.senderId === jid
                            )
                            .slice(-5);

                        let context = `=== WhatsApp Context for ${jid} ===\n\n`;

                        if (profile) {
                            context += `📋 PROFILE:\n${profile}\n\n`;
                        } else {
                            context += `📋 PROFILE: No profile stored yet.\n\n`;
                        }

                        if (chatHistory.length > 0) {
                            context += `💬 RECENT MESSAGES (${chatHistory.length}):\n`;
                            chatHistory.forEach((m: any) => {
                                context += `[${m.timestamp}] ${m.content}\n`;
                            });
                        } else {
                            context += `💬 RECENT MESSAGES: No recent messages found.\n`;
                        }

                        return context;
                    } catch (e) {
                        return `Error getting context: ${e}`;
                    }
                }
            },
    {
                name: 'recall_memory',
                description: 'Search your entire memory semantically — finds relevant memories across ALL channels, time periods, and memory types (short, episodic, long-term). Use this when you need to remember something from a past conversation, find context about a topic, or recall what happened with a specific person/project. Much more powerful than keyword search.',
                usage: 'recall_memory(query, limit?)',
                isParallelSafe: true,
                handler: async (args: any, ctx: SkillContext) => {
                    const query = args.query || args.search || args.text || args.q;
                    const limit = parseInt(args.limit || '10', 10);

                    if (!query) return 'Error: Missing query. Provide a natural language description of what you want to recall.';

                    try {
                        // Try semantic search first (best quality)
                        if (ctx.memory.vectorMemory?.isEnabled()) {
                            const results = await ctx.memory.semanticRecall(query, limit);
                            if (results.length > 0) {
                                const formatted = results.map((r, i) => {
                                    const src = r.metadata?.source ? ` [${r.metadata.source}]` : '';
                                    const type = r.type || 'unknown';
                                    return `${i + 1}. [${r.timestamp}] (${type}${src}, relevance: ${(r.score * 100).toFixed(0)}%) ${r.content}`;
                                }).join('\n\n');
                                return `Found ${results.length} relevant memories:\n\n${formatted}`;
                            }
                        }

                        // Fallback: keyword search across all memory types
                        const queryLower = query.toLowerCase();
                        const allMemories = [
                            ...ctx.memory.searchMemory('short'),
                            ...ctx.memory.searchMemory('episodic'),
                        ];
                        const matches = allMemories
                            .filter(m => (m.content || '').toLowerCase().includes(queryLower))
                            .sort((a, b) => {
                                const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                                const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                                return tb - ta;
                            })
                            .slice(0, limit);

                        if (matches.length === 0) {
                            return `No memories found matching "${query}". The search covers all conversations and past actions.`;
                        }

                        const formatted = matches.map((m, i) => {
                            const src = m.metadata?.source ? ` [${m.metadata.source}]` : '';
                            return `${i + 1}. [${m.timestamp}] (${m.type}${src}) ${m.content}`;
                        }).join('\n\n');
                        return `Found ${matches.length} memories (keyword match):\n\n${formatted}`;
                    } catch (e) {
                        return `Error recalling memory: ${e}`;
                    }
                }
            },
    {
                name: 'search_memory_logs',
                description: 'Literal search across all daily memory log files, JOURNAL.md, and LEARNING.md. Use this for "deep" history search when semantic recall fails, or when you need to find exact technical details, dates, or specific names mentioned in the past. This is a very robust fallback.',
                usage: 'search_memory_logs(query, limit?)',
                isParallelSafe: true,
                handler: async (args: any, ctx: SkillContext) => {
                    const query = args.query || args.q || args.text;
                    const limit = parseInt(args.limit || '10', 10);

                    if (!query) return 'Error: Missing query string.';

                    try {
                        const dailyMemory = ctx.memory.getDailyMemory();
                        const logFiles = dailyMemory.listDailyMemories();
                        const results: string[] = [];
                        const queryLower = query.toLowerCase();

                        // 1. Search daily logs (most recent first)
                        for (const date of logFiles) {
                            if (results.length >= limit) break;
                            const content = dailyMemory.readDailyMemory(date);
                            if (content && content.toLowerCase().includes(queryLower)) {
                                // Extract snippet around the match
                                const idx = content.toLowerCase().indexOf(queryLower);
                                const start = Math.max(0, idx - 150);
                                const end = Math.min(content.length, idx + queryLower.length + 250);
                                results.push(`--- Log: ${date} ---\n...${content.slice(start, end)}...`);
                            }
                        }

                        // 2. Search main identity files
                        const identityFiles = ['JOURNAL.md', 'LEARNING.md', 'USER.md'];
                        const dataHome = ctx.config.getDataHome();
                        for (const file of identityFiles) {
                            if (results.length >= limit) break;
                            const filePath = path.join(dataHome, file);
                            if (fs.existsSync(filePath)) {
                                const content = fs.readFileSync(filePath, 'utf-8');
                                if (content.toLowerCase().includes(queryLower)) {
                                    const idx = content.toLowerCase().indexOf(queryLower);
                                    const start = Math.max(0, idx - 150);
                                    const end = Math.min(content.length, idx + queryLower.length + 250);
                                    results.push(`--- File: ${file} ---\n...${content.slice(start, end)}...`);
                                }
                            }
                        }

                        if (results.length === 0) {
                            return `No literal matches for "${query}" found in daily logs or identity files.`;
                        }

                        return `Found ${results.length} matches in memory logs:\n\n${results.join('\n\n')}`;
                    } catch (e) {
                        return `Error searching memory logs: ${e}`;
                    }
                }
            },
    {
                name: 'list_memory_logs',
                description: 'List all available daily memory log dates. Useful to see how far back your history goes or to identify specific days to search.',
                usage: 'list_memory_logs()',
                isParallelSafe: true,
                handler: async (_args: any, ctx: SkillContext) => {
                    try {
                        const dailyMemory = ctx.memory.getDailyMemory();
                        const logFiles = dailyMemory.listDailyMemories();
                        if (logFiles.length === 0) return 'No daily memory logs found.';

                        const stats = dailyMemory.getStats();
                        return `Available memory logs (${logFiles.length} days):\n- Range: ${logFiles[logFiles.length - 1]} to ${logFiles[0]}\n- Data Dir: ${stats.memoryDir}\n\nRecent logs:\n${logFiles.slice(0, 15).join('\n')}${logFiles.length > 15 ? '\n...' : ''}`;
                    } catch (e) {
                        return `Error listing memory logs: ${e}`;
                    }
                }
            },
    {
                name: 'read_memory_log',
                description: 'Read the full content of a specific daily memory log. Use list_memory_logs to see available dates and search_memory_logs to find relevant ones. Date format: YYYY-MM-DD.',
                usage: 'read_memory_log(date)',
                isParallelSafe: true,
                handler: async (args: any, ctx: SkillContext) => {
                    const date = args.date || args.text;
                    if (!date) return 'Error: Missing date string (YYYY-MM-DD).';

                    try {
                        const dailyMemory = ctx.memory.getDailyMemory();
                        const content = dailyMemory.readDailyMemory(date);
                        if (!content) return `Error: No memory log found for date: ${date}`;

                        const MAX_CHARS = 15000;
                        if (content.length > MAX_CHARS) {
                            return content.substring(0, MAX_CHARS) + `\n\n[...truncated. ${content.length} chars total. Use search_memory_logs to find specific snippets if needed.]`;
                        }
                        return `=== Memory Log: ${date} ===\n\n${content}`;
                    } catch (e) {
                        return `Error reading memory log: ${e}`;
                    }
                }
            },
    {
                name: 'update_user_profile',
                description: 'Save permanent information learned about the user (name, preferences, habits, goals). Use this PROACTIVELY whenever you learn something new about the user.',
                usage: 'update_user_profile(info_text)',
                handler: async (args: any, ctx: SkillContext) => {
                    const info_text = args.info_text || args.info || args.text || args.data;
                    if (!info_text) return 'Error: Missing info_text.';

                    const userPath = ctx.config.get('userProfilePath');
                    try {
                        // Prepend date for chronological history
                        const entry = `\n- [${new Date().toLocaleDateString()}] ${info_text}`;
                        fs.appendFileSync(userPath, entry);
                        ctx.memory.refreshUserContext(userPath);
                        logger.info(`User Profile Updated: ${info_text}`);
                        return `Successfully updated user profile with: "${info_text}"`;
                    } catch (e) {
                        return `Failed to update profile at ${userPath}: ${e}`;
                    }
                }
            },
    {
                    name: 'await_subtask',
                    description: 'Wait for a previously delegated task to finish and return its result. Polls every 3 seconds up to timeoutSeconds (default 120). Use after delegate_task() when you need the result before continuing.',
                    usage: 'await_subtask(task_id, timeoutSeconds?)',
                    isDeep: true,
                    handler: async (args: any, ctx: SkillContext) => {
                        const taskId = args.task_id || args.id || args.taskId;
                        const timeout = Math.min(parseInt(args.timeoutSeconds || args.timeout || '120'), 300);
                        if (!taskId) return 'Error: Missing task_id.';

                        const pollMs = 3000;
                        const deadline = Date.now() + timeout * 1000;

                        while (Date.now() < deadline) {
                            const action = ctx.actionQueue.getAction(taskId);
                            if (!action) return `Error: Task "${taskId}" not found.`;

                            if (action.status === 'completed' || action.status === 'failed') {
                                // Retrieve the conclusion from episodic memory
                                const conclusionId = `${taskId}-conclusion`;
                                const conclusion = ctx.memory.getMemory(conclusionId);
                                const resultText = conclusion?.content || `Task ${action.status} (no conclusion stored).`;
                                return `Subtask "${taskId}" ${action.status}. Result: ${resultText}`;
                            }

                            await new Promise(resolve => setTimeout(resolve, pollMs));
                        }
                        return `Subtask "${taskId}" did not complete within ${timeout}s (still ${ctx.actionQueue.getAction(taskId)?.status || 'unknown'}).`;
                    }
                },
    {
                    name: 'run_subtask',
                    description: 'Create a subtask, wait for it to complete, and return its result — all in one step. Ideal for parallel research, file processing, or breaking a complex task into focused sub-problems. timeoutSeconds defaults to 120, max 300.',
                    usage: 'run_subtask(description, timeoutSeconds?, priority?)',
                    isDeep: true,
                    handler: async (args: any, ctx: SkillContext) => {
                        const description = args.description || args.task;
                        const timeout = Math.min(parseInt(args.timeoutSeconds || args.timeout || '120'), 300);
                        const priority = parseInt(args.priority || '5');
                        if (!description) return 'Error: Missing task description.';

                        // Enforce max spawn depth (workers cannot spawn further sub-tasks)
                        const depth = (args._spawnDepth || 0) as number;
                        const MAX_DEPTH = 2;
                        if (depth >= MAX_DEPTH) {
                            return `Error: Spawn depth limit (${MAX_DEPTH}) reached. Execute this work directly instead of delegating further.`;
                        }

                        try {
                            const subtaskId = `subtask-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
                            ctx.actionQueue.push({
                                id: subtaskId,
                                type: 'message',
                                status: 'pending',
                                priority,
                                payload: {
                                    description,
                                    isSubtask: true,
                                    parentActionId: args._parentActionId,
                                    spawnDepth: depth + 1,
                                },
                                timestamp: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            });

                            const pollMs = 3000;
                            const deadline = Date.now() + timeout * 1000;

                            while (Date.now() < deadline) {
                                const action = ctx.actionQueue.getAction(subtaskId);
                                if (!action) return `Error: Subtask "${subtaskId}" disappeared from queue.`;

                                if (action.status === 'completed' || action.status === 'failed') {
                                    const conclusionId = `${subtaskId}-conclusion`;
                                    const conclusion = ctx.memory.getMemory(conclusionId);
                                    const resultText = conclusion?.content || `Subtask ${action.status} (no conclusion stored).`;
                                    return `[Subtask result] ${resultText}`;
                                }

                                await new Promise(resolve => setTimeout(resolve, pollMs));
                            }

                            return `Subtask "${subtaskId}" did not complete within ${timeout}s — it will continue running in background. Check await_subtask("${subtaskId}") later.`;
                        } catch (e) {
                            return `Error creating subtask: ${e}`;
                        }
                    }
                }
];

export function registerMemorySkills(registry: SkillRegistry) {
    for (const skill of memoryContextSkills) {
        registry.registerSkill(skill);
    }
}
