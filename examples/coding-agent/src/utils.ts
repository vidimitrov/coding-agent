import { countTokens } from "@anthropic-ai/tokenizer";
import Anthropic from "@anthropic-ai/sdk";
import type { TokenUsage, SessionStats } from "./types";
import { tools } from "./tools";

// ========================
// COLORS & STYLING
// ========================

// Simple ANSI colors - no dependencies
export const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
};

// ASCII Art Banner
export const banner = `${c.cyan}
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║    ╔═╗ ╔═╗ ╔══╗ ╦ ╔╗╔ ╔═╗    ╦═╗ ╔═╗ ╔══╗ ╔╗╔ ╔╦═         ║
    ║    ║   ║ ║ ║  ║ ║ ║║║ ║ ╦    ╬═╣ ║ ╦ ║╣   ║║║  ║          ║
    ║    ╚═╝ ╚═╝ ╚══╝ ╩ ╝╚╝ ╚═╝    ╩ ╩ ╚═╝ ╚══╝ ╝╚╝  ╩          ║
    ║                                                           ║
    ║              ${c.yellow}⚡ Powered by Claude & Bun ⚡${c.cyan}              ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
${c.reset}`;

// ========================
// TOKEN USAGE & CONTEXT
// ========================

// Fetch model context window size (call once at session start)
export async function fetchModelContextWindow(): Promise<number> {
  try {
    // Claude-3.5-Sonnet has a 200k token context window
    // This could be fetched from the API if needed, but for now we'll use known values
    const modelContextWindows: { [key: string]: number } = {
      'claude-sonnet-4-20250514': 200000,
      'claude-3-5-sonnet-20241022': 200000,
      'claude-3-haiku-20240307': 200000,
      'claude-3-opus-20240229': 200000
    };
    
    return modelContextWindows['claude-sonnet-4-20250514'] || 200000;
  } catch (error) {
    console.log(`${c.yellow}Warning: Could not fetch context window size, using default 200k${c.reset}`);
    return 200000;
  }
}

// Calculate token usage for a message
export function calculateTokenUsage(messages: Anthropic.MessageParam[], systemPrompt: string, response: Anthropic.Message): TokenUsage {
  // Calculate input tokens (messages + system prompt + tools)
  let inputText = systemPrompt;
  
  for (const message of messages) {
    if (typeof message.content === 'string') {
      inputText += message.content;
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'text') {
          inputText += block.text;
        } else if (block.type === 'tool_result') {
          if (typeof block.content === 'string') {
            inputText += block.content;
          }
        }
      }
    }
  }
  
  // Add tools definition to input count
  inputText += JSON.stringify(tools);
  
  // Calculate output tokens
  let outputText = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      outputText += block.text;
    } else if (block.type === 'tool_use') {
      outputText += JSON.stringify(block.input);
    }
  }
  
  const inputTokens = countTokens(inputText);
  const outputTokens = countTokens(outputText);
  const totalTokens = inputTokens + outputTokens;
  
  return { inputTokens, outputTokens, totalTokens };
}

// Just show context usage as a single line
export function updateContextUsage(usage: TokenUsage, stats: SessionStats) {
  stats.totalTokens += usage.totalTokens;
  stats.currentConversationTokens += usage.inputTokens;
  stats.requestCount++;
  
  const contextUtilization = stats.maxContextTokens > 0 ? 
    ((stats.currentConversationTokens / stats.maxContextTokens) * 100).toFixed(1) : '0.0';
  
  // Color the percentage based on usage
  let contextColor = c.green;
  if (parseFloat(contextUtilization) > 80) contextColor = c.red;
  else if (parseFloat(contextUtilization) > 60) contextColor = c.yellow;
  
  // Single line, minimally intrusive
  console.log(`${c.dim}Context: ${contextColor}${contextUtilization}%${c.reset} ${c.dim}• Tokens: +${usage.totalTokens} (session: ${stats.totalTokens.toLocaleString()})${c.reset}`);
}