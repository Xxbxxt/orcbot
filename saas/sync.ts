import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'yaml';

/**
 * Registry Sync - Scans the instances folder and ensures all SaaS bots are registered in agents.json.
 */
async function syncRegistry() {
    const dataDir = path.join(os.homedir(), '.orcbot', 'orchestrator');
    const instancesDir = path.join(dataDir, 'instances');
    const registryPath = path.join(dataDir, 'agents.json');

    console.log(`🔍 Scanning for bots in: ${instancesDir}`);

    if (!fs.existsSync(instancesDir)) {
        console.error('❌ Error: Instances directory not found.');
        return;
    }

    let registry: any[] = [];
    if (fs.existsSync(registryPath)) {
        try {
            registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        } catch (e) {
            console.error('❌ Error parsing agents.json, starting fresh.');
            registry = [];
        }
    }

    const instances = fs.readdirSync(instancesDir);
    let added = 0;
    let repaired = 0;

    for (const id of instances) {
        const instanceDir = path.join(instancesDir, id);
        const configPath = path.join(instanceDir, 'orcbot.config.yaml');

        if (fs.statSync(instanceDir).isDirectory() && fs.existsSync(configPath)) {
            try {
                const configText = fs.readFileSync(configPath, 'utf-8');
                let config = yaml.parse(configText);
                
                // REPAIR: Ensure auto-reply is enabled for SaaS bots
                let needsSave = false;
                const autoReplyKeys = ['telegramAutoReplyEnabled', 'whatsappAutoReplyEnabled', 'discordAutoReplyEnabled', 'slackAutoReplyEnabled', 'emailAutoReplyEnabled'];
                for (const key of autoReplyKeys) {
                    if (config[key] !== true) {
                        config[key] = true;
                        needsSave = true;
                    }
                }

                if (needsSave) {
                    fs.writeFileSync(configPath, yaml.stringify(config));
                    console.log(`🔧 Repaired auto-reply settings for: ${id}`);
                    repaired++;
                }

                // Register if missing
                if (!registry.find(a => a.id === id)) {
                    registry.push({
                        id: id,
                        name: config.agentName || id,
                        role: config.agentRole || 'worker',
                        parentId: 'primary',
                        capabilities: ['execute', 'browse', 'web_search', 'read_file'],
                        status: 'idle',
                        currentTask: null,
                        createdAt: new Date().toISOString(),
                        lastActiveAt: new Date().toISOString(),
                        memoryPath: path.join(instanceDir, 'memory.json'),
                        profilePath: path.join(instanceDir, 'profile.json')
                    });

                    // Ensure memory file exists
                    if (!fs.existsSync(path.join(instanceDir, 'memory.json'))) {
                        fs.writeFileSync(path.join(instanceDir, 'memory.json'), JSON.stringify({ short: [], episodic: [], semantic: [] }, null, 2));
                    }

                    console.log(`✅ Registered missing agent: ${id}`);
                    added++;
                }
            } catch (e) {
                console.error(`❌ Error processing ${id}: ${e}`);
            }
        }
    }

    if (added > 0 || repaired > 0) {
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
        console.log(`\n🎉 Sync complete! Added ${added} agents, Repaired ${repaired} agents.`);
    } else {
        console.log('\n✨ Registry is already up to date.');
    }
}

syncRegistry().catch(console.error);
