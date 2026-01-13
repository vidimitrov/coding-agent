#!/usr/bin/env bun
/**
 * index.ts - Modular agentic loop entry point
 * Run: bun index.ts
 */

import * as readline from "readline";
import { runAgent } from "./src/agent";
import { fetchModelContextWindow, c, banner } from "./src/utils";
import type { SessionStats } from "./src/types";

const cwd = process.cwd();

// Interactive REPL
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Initialize session stats
  const sessionStats: SessionStats = {
    totalTokens: 0,
    requestCount: 0,
    maxContextTokens: 0,
    currentConversationTokens: 0,
  };

  // Display the cool ASCII banner
  console.log(banner);
  console.log(`${c.dim}Working directory: ${cwd}${c.reset}`);
  
  // Fetch context window size once at session start
  sessionStats.maxContextTokens = await fetchModelContextWindow();
  console.log(`${c.dim}Context window: ${c.cyan}${sessionStats.maxContextTokens.toLocaleString()}${c.reset} tokens${c.reset}`);
  
  console.log(`${c.dim}Type 'exit' to quit${c.reset}\n`);

  const prompt = () => {
    rl.question(`${c.yellow}› ${c.reset}`, async (input) => {
      if (input.toLowerCase() === "exit") {
        const finalContextUtilization = sessionStats.maxContextTokens > 0 ? 
          ((sessionStats.currentConversationTokens / sessionStats.maxContextTokens) * 100).toFixed(1) : '0.0';
        
        console.log(`\n${c.dim}Session Summary:${c.reset}`);
        console.log(`${c.dim}Total requests: ${c.cyan}${sessionStats.requestCount}${c.reset}`);
        console.log(`${c.dim}Total tokens used: ${c.magenta}${sessionStats.totalTokens.toLocaleString()}${c.reset}`);
        console.log(`${c.dim}Context utilized: ${c.bold}${finalContextUtilization}%${c.reset} ${c.dim}(${sessionStats.currentConversationTokens.toLocaleString()}/${sessionStats.maxContextTokens.toLocaleString()})${c.reset}`);
        console.log(`${c.dim}Average tokens per request: ${c.yellow}${sessionStats.requestCount > 0 ? Math.round(sessionStats.totalTokens / sessionStats.requestCount).toLocaleString() : 0}${c.reset}\n`);
        rl.close();
        return;
      }
      if (input.trim()) {
        await runAgent(input, sessionStats);
      }
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);