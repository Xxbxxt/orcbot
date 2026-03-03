import { MultiLLM } from './MultiLLM';
import { logger } from '../utils/logger';
import { ParserLayer } from './ParserLayer';

export type BlockVerdict = 'CONTINUE' | 'STOP';

export interface ReviewResult {
    verdict: BlockVerdict;
    reasoning: string;
    suggestedStrategy?: string;
}

/**
 * LLM Reviewer that specifically handles "hard blocks" or "restrictions".
 * It analyzes the failure context and decides if the agent should keep trying with a new strategy
 * or if it's a genuine dead end.
 */
export class BlockReviewer {
    constructor(private llm: MultiLLM) {}

    public async reviewBlock(
        task: string,
        history: string,
        error: string,
        context: {
            actionId: string;
            currentStep: number;
            browserUrl?: string;
            browserEngine?: string;
            lastToolUsed?: string;
            failureType?: string;
        }
    ): Promise<ReviewResult> {
        logger.info(`BlockReviewer: Reviewing hard block for action ${context.actionId} (Step ${context.currentStep})`);

        const prompt = `
# SYSTEM: HARD BLOCK REVIEWER
You are a high-level supervisor for an autonomous agent. The agent has hit a "hard block", "restriction", or "loop" during a task.
Your job is to decide if the agent should:
1. **CONTINUE**: Provide a new strategy to bypass the block or break the loop.
2. **STOP**: Concede that the task is currently impossible, restricted, or failing fundamentally.

## TASK:
${task}

## ACTION HISTORY (Ground Truth):
${history}

## THE HARD BLOCK / ERROR / LOOP:
"${error}"

## CURRENT CONTEXT:
- Action ID: ${context.actionId}
- Step: ${context.currentStep}
- Last Tool Used: ${context.lastToolUsed || 'N/A'}
- Failure Type: ${context.failureType || 'Technical'}
${context.browserUrl ? `- Browser URL: ${context.browserUrl}` : ''}
${context.browserEngine ? `- Browser Engine: ${context.browserEngine}` : ''}

## DECISION CRITERIA:
- **Permanent Restriction**: (e.g., "Access Denied", "Unauthorized", "Not Allowed by Policy", "API Quota Empty") -> STOP
- **Transient/Technical**: (e.g., "Timeout", "Element Intercepted", "Bot Detection", "Network Error") -> CONTINUE
- **Logic Loop**: (e.g., Calling the same tool with the same result 3+ times) -> CONTINUE (must provide a *new* strategy)
- **Feasibility**: Is there a valid alternative path (e.g., "Try a different API", "Search the web instead of direct access", "Use a different file format")? -> CONTINUE
- **Exhaustion**: If the agent is clearly going in circles and you see no path forward -> STOP

## RESPONSE FORMAT:
Return ONLY a JSON object:
{
  "verdict": "CONTINUE" | "STOP",
  "reasoning": "Brief explanation of why you made this choice",
  "suggested_strategy": "If CONTINUE, provide a specific instruction for the agent's next step to avoid repeating the failure"
}
`;

        try {
            const response = await this.llm.callFast(prompt, "You are a quality assurance supervisor.");
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return { verdict: 'CONTINUE', reasoning: 'Reviewer failed to parse JSON, defaulting to CONTINUE.', suggestedStrategy: 'Try a different approach.' };
            }

            const parsed = JSON.parse(jsonMatch[0]);
            return {
                verdict: parsed.verdict || 'CONTINUE',
                reasoning: parsed.reasoning || 'No reasoning provided',
                suggestedStrategy: parsed.suggested_strategy
            };
        } catch (e) {
            logger.error(`BlockReviewer: Error during review: ${e}`);
            return { verdict: 'CONTINUE', reasoning: 'Reviewer crashed, defaulting to CONTINUE.' };
        }
    }
}
