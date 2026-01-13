import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool } from "./tools";
import { calculateTokenUsage, updateContextUsage, c } from "./utils";
import type { SessionStats } from "./types";

const client = new Anthropic();
const cwd = process.cwd();

// Random sci-fi verbs for agentic behavior
const sciFiVerbs = [
  "Synthesizing",
  "Calibrating",
  "Harmonizing", 
  "Materializing",
  "Amplifying",
  "Crystallizing",
  "Metamorphosing",
  "Transmuting",
  "Interfacing",
  "Resonating",
  "Deciphering",
  "Configuring",
  "Quantifying",
  "Fragmenting",
  "Reconstructing",
  "Manifesting",
  "Optimizing",
  "Integrating",
  "Virtualizing",
  "Extrapolating"
];

function getRandomSciFiVerb(): string {
  const verb = sciFiVerbs[Math.floor(Math.random() * sciFiVerbs.length)];
  return `${c.green}${verb}...${c.reset}`;
}

// The agentic loop
export async function runAgent(userMessage: string, sessionStats: SessionStats) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  const systemPrompt = `You are a coding assistant. Working directory: ${cwd}
Use tools to help the user. Be concise.`;

  let loopCount = 0;
  
  // Keep looping until Claude stops calling tools
  while (true) {
    loopCount++;
    sessionStats.requestCount++;
    
    console.log(`\n${c.dim}${getRandomSciFiVerb()}${c.reset}`);
    
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Calculate and display token usage
    const tokenUsage = calculateTokenUsage(messages, systemPrompt, response);
    updateContextUsage(tokenUsage, sessionStats);

    let hasToolUse = false;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        console.log(`\n${c.green}▌${c.reset} ${block.text}`);
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        const args = JSON.stringify(block.input);
        console.log(`\n${c.dim}┌─ ${c.cyan}${block.name}${c.reset}${c.dim} ─────────────────────────${c.reset}`);
        console.log(`${c.dim}│${c.reset} ${c.gray}${args.length > 80 ? args.slice(0, 80) + "..." : args}${c.reset}`);
        const result = await executeTool(block.name, block.input);
        const preview = result.slice(0, 150).replace(/\n/g, " ");
        console.log(`${c.dim}│${c.reset} ${c.yellow}→${c.reset} ${preview}${result.length > 150 ? "..." : ""}`);
        console.log(`${c.dim}└────────────────────────────────────${c.reset}`);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }

    // Add assistant's response to history
    messages.push({ role: "assistant", content: response.content });

    // If there were tool calls, add results and continue the loop
    if (hasToolUse) {
      messages.push({ role: "user", content: toolResults });
    } else {
      // No tool calls = Claude is done
      break;
    }
  }
}