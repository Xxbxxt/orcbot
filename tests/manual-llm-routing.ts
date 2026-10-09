
import { PromptRouter, RouterLLM } from './src/core/prompts/PromptRouter';
import { PromptHelperContext } from './src/core/prompts/PromptHelper';

async function test() {
    const mockLLM: RouterLLM = {
        call: async (prompt, system) => {
            console.log("\n--- LLM CLASSIFIER CALL ---");
            console.log("User Prompt:", prompt);
            return '["browser", "research"]';
        }
    };

    const router = new PromptRouter();
    router.setLLM(mockLLM);

    const context: PromptHelperContext = {
        taskDescription: "x", // Minimal task to avoid regex matches
        metadata: { source: 'cli' },
        availableSkills: "",
        agentIdentity: "",
        isFirstStep: true,
        systemContext: "",
        bootstrapContext: {},
    };

    console.log("Routing task...");
    const result = await router.route(context);
    console.log("\n--- ROUTE RESULT ---");
    console.log("Active Helpers:", result.activeHelpers);
    console.log("Routing Method:", result.routingMethod);
}

test().catch(console.error);
