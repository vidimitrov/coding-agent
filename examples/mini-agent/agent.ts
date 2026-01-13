#!/usr/bin/env bun
/**
 * agent.ts - A stripped-down agentic loop in a single file
 * Run: bun agent.ts
 * Or:  bun agent.ts "your prompt here"
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { spawn } from "child_process";

const client = new Anthropic();
const cwd = process.cwd();

// Simple ANSI colors - no dependencies
const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  white: "\x1b[37m",
};

// Banner
function showBanner() {
  console.log(`${c.green}${c.bold}
╔═══════════════════════════════════════════════════════════════════════════════════╗
║                                                                                   ║
║    ███╗   ███╗██╗███╗   ██╗██╗       █████╗  ██████╗ ███████╗███╗   ██╗████████╗  ║
║    ████╗ ████║██║████╗  ██║██║      ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝  ║
║    ██╔████╔██║██║██╔██╗ ██║██║      ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║     ║
║    ██║╚██╔╝██║██║██║╚██╗██║██║      ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║     ║
║    ██║ ╚═╝ ██║██║██║ ╚████║██║      ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║     ║
║    ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝      ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝     ║
║                                                                                   ║
╚═══════════════════════════════════════════════════════════════════════════════════╝${c.reset}

${c.white}${c.bold}🤖 Your AI coding agent${c.reset}
${c.dim}Working directory: ${cwd}${c.reset}
`);
}

// Simple tools definition - inline everything
const tools: Anthropic.Tool[] = [
  {
    name: "read_file",
    description: "Read contents of a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_dir",
    description: "List directory contents",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string", description: "Directory path" },
      },
      required: ["path"],
    },
  },
  {
    name: "bash",
    description: "Run a shell command",
    input_schema: {
      type: "object" as const,
      properties: {
        command: { type: "string", description: "Command to run" },
      },
      required: ["command"],
    },
  },
];

// Tool execution - dead simple
async function executeTool(name: string, input: any): Promise<string> {
  const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(cwd, p));

  switch (name) {
    case "read_file": {
      try {
        return fs.readFileSync(resolvePath(input.path), "utf-8");
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    case "write_file": {
      try {
        fs.writeFileSync(resolvePath(input.path), input.content);
        return `Written to ${input.path}`;
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    case "list_dir": {
      try {
        const entries = fs.readdirSync(resolvePath(input.path), { withFileTypes: true });
        return entries
          .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
          .join("\n");
      } catch (e: any) {
        return `Error: ${e.message}`;
      }
    }
    case "bash": {
      return new Promise((resolve) => {
        const proc = spawn("bash", ["-c", input.command], { cwd });
        let stdout = "", stderr = "";
        proc.stdout.on("data", (d) => (stdout += d));
        proc.stderr.on("data", (d) => (stderr += d));
        proc.on("close", (code) => {
          resolve(`Exit code: ${code}\n${stdout}${stderr ? `\nStderr: ${stderr}` : ""}`);
        });
        proc.on("error", (e) => resolve(`Error: ${e.message}`));
      });
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

// The agentic loop
async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  const systemPrompt = `You are a coding assistant. Working directory: ${cwd}
Use tools to help the user. Be concise.`;

  while (true) {
    // Call Claude
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    // Process response
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

    // Add assistant message to history
    messages.push({ role: "assistant", content: response.content });

    // If there were tool uses, add results and continue
    if (hasToolUse) {
      messages.push({ role: "user", content: toolResults });
    } else {
      // No more tool calls, we're done
      break;
    }

    if (response.stop_reason === "end_turn" && !hasToolUse) break;
  }
}

// Simple REPL or one-shot mode
async function main() {
  // Show banner
  showBanner();

  // One-shot mode: bun mini-agent.ts "do something"
  if (process.argv[2]) {
    await runAgent(process.argv.slice(2).join(" "));
    return;
  }

  // REPL mode
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`${c.dim}Type 'exit' to quit${c.reset}\n`);

  const prompt = () => {
    rl.question(`${c.yellow}› ${c.reset}`, async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }
      if (input.trim()) {
        await runAgent(input);
      }
      prompt();
    });
  };

  prompt();
}

main().catch(console.error);