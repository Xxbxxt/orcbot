import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import WebSocket from 'ws';
import { GatewayServer } from '../src/gateway/GatewayServer';
import { eventBus } from '../src/core/EventBus';

function waitForMessage(socket: WebSocket, predicate: (message: any) => boolean, timeoutMs = 3000): Promise<any> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.off('message', onMessage);
            reject(new Error('Timed out waiting for WebSocket message'));
        }, timeoutMs);

        const onMessage = (raw: WebSocket.RawData) => {
            try {
                const parsed = JSON.parse(raw.toString());
                if (!predicate(parsed)) {
                    return;
                }
                clearTimeout(timeout);
                socket.off('message', onMessage);
                resolve(parsed);
            } catch {
                // Ignore non-JSON payloads during the wait window.
            }
        };

        socket.on('message', onMessage);
    });
}

describe('GatewayServer', () => {
    let dataHome: string;
    let gateway: GatewayServer;
    let port: number;
    let socket: WebSocket | null = null;

    beforeEach(async () => {
        dataHome = fs.mkdtempSync(path.join(os.tmpdir(), 'orcbot-gateway-'));

        const agent = {
            isRunning: false,
            skills: {
                getAllSkills: () => []
            },
            memory: {
                getRecentContext: () => []
            },
            orchestrator: {
                getAgents: () => [],
                getTasks: () => []
            }
        };

        const config = {
            get: (key: string) => {
                const values: Record<string, any> = {
                    gatewayHost: '127.0.0.1',
                    gatewayPort: 3100,
                    modelName: 'test-model',
                    llmProvider: 'openai',
                    safeMode: false,
                    whatsappEnabled: false
                };
                return values[key];
            },
            getDataHome: () => dataHome
        };

        gateway = new GatewayServer(agent as any, config as any, {
            host: '127.0.0.1',
            staticDir: path.join(process.cwd(), 'apps', 'dashboard')
        });

        (gateway as any).gatewayConfig.port = 0;
        await gateway.start();
        port = ((gateway as any).server.address() as { port: number }).port;
    });

    afterEach(() => {
        try {
            socket?.close();
        } catch {}
        gateway.stop();
        try {
            fs.rmSync(dataHome, { recursive: true, force: true });
        } catch {}
    });

    it('forwards chat:message gateway responses to websocket clients', async () => {
        socket = new WebSocket(`ws://127.0.0.1:${port}/`);

        await new Promise<void>((resolve, reject) => {
            socket?.once('open', () => resolve());
            socket?.once('error', (error) => reject(error));
        });

        const messagePromise = waitForMessage(socket, (message) => message.type === 'chat:message');

        eventBus.emit('gateway:chat:response', {
            type: 'chat:message',
            role: 'assistant',
            content: 'Gateway reply',
            timestamp: new Date().toISOString(),
            metadata: { source: 'gateway-chat' }
        });

        const message = await messagePromise;
        expect(message.type).toBe('chat:message');
        expect(message.content).toBe('Gateway reply');
        expect(message.role).toBe('assistant');
    });
});