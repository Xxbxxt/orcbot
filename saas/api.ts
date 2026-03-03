import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';

const app = express();
const port = 3005;

app.use(cors());
app.use(express.json());

app.post('/api/provision', (req, res) => {
    const { name, blueprint, token, userId } = req.body;

    if (!name || !token || !userId) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`\n[SaaS API] Provisioning request for: ${name} (${blueprint})`);

    // Construct the command to run our provisioner
    const command = `npx ts-node saas/provision.ts --customer "${name}" --blueprint "${blueprint}" --token "${token}" --id "${userId}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Provisioning Error: ${error.message}`);
            return res.status(500).json({ error: 'Failed to provision bot', details: stderr });
        }
        
        console.log(`Provisioning Output: ${stdout}`);

        // Extract the generated Agent ID from the provisioner output
        const idMatch = stdout.match(/SaaS Bot "([^"]+)" is ready/);
        const agentId = idMatch ? idMatch[1] : 'unknown';

        // AUTO-SYNC: Ensure the registry is updated so CLI can see it immediately
        exec(`npx ts-node saas/sync.ts`, (sErr, sStdout) => {
            if (sErr) console.error(`Sync Warning: ${sErr.message}`);
            
            // Generate the one-liners for the user to run locally
            const baseUrl = `http://${req.headers.host}`; // Fallback if we wanted to host the scripts
            
            // For now, we'll provide the direct script execution command
            // We pass the parameters as arguments to the script
            const winCommand = `powershell -ExecutionPolicy Bypass -Command "iwr -useb ${baseUrl}/scripts/install.ps1 | iex; & {install-orcbot -CustomerName '${name}' -Blueprint '${blueprint}' -Token '${token}' -UserId '${userId}' -AgentId '${agentId}'}"`;
            
            // Simplified version for easier copy-pasting if we don't host the script yet:
            const manualWin = `powershell -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $c='${name}'; $b='${blueprint}'; $t='${token}'; $u='${userId}'; $a='${agentId}'; iex(iwr -UseBasicParsing 'https://raw.githubusercontent.com/fredabila/orcbot/main/saas/scripts/install.ps1').Content"`;
            
            const manualLin = `curl -sSL https://raw.githubusercontent.com/fredabila/orcbot/main/saas/scripts/install.sh | bash -s -- "${name}" "${blueprint}" "${token}" "${userId}" "${agentId}"`;

            res.json({ 
                success: true, 
                message: 'Bot profile generated successfully!',
                agentId: agentId,
                commands: {
                    windows: manualWin,
                    linux: manualLin
                }
            });
        });
    });
});

app.listen(port, () => {
    console.log(`\n🚀 SaaS Provisioning API running at http://localhost:${port}`);
});
