import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import readline from "readline";
import { colorize, createBox, createDevBgBanner, colors } from "./colors";

const client = new Anthropic();
const cwd = process.cwd();

const tools: Anthropic.Tool[] = [
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
  {
    name: "grep_search",
    description: "Search for a pattern in files (supports regex)",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string", description: "Pattern to search for (can be regex)" },
        path: { type: "string", description: "File or directory path to search in" },
        recursive: { type: "boolean", description: "Search recursively in subdirectories" },
        case_sensitive: { type: "boolean", description: "Case sensitive search" },
        file_extensions: { type: "array", items: { type: "string" }, description: "Filter by file extensions (e.g., ['.js', '.ts'])" },
      },
      required: ["pattern", "path"],
    },
  },
];

async function executeTool(name: string, input: any): Promise<string> {
  const resolvePath = (p: string) => (path.isAbsolute(p) ? p : path.join(cwd, p));

  switch (name) {
    case "list_dir": {
      try {
        const entries = fs.readdirSync(resolvePath(input.path), { withFileTypes: true });
        return entries
          .map((e) => {
            if (e.isDirectory()) {
              return colorize.directory(`${e.name}/`);
            } else {
              // Check if file is executable
              try {
                const filePath = path.join(resolvePath(input.path), e.name);
                const stats = fs.statSync(filePath);
                if (stats.mode & parseInt('111', 8)) {
                  return colorize.executable(e.name);
                }
              } catch {}
              return colorize.file(e.name);
            }
          })
          .join("\n");
      } catch (error) {
        return colorize.error(`Error reading directory: ${error}`);
      }
    }
    case "read_file": {
      try {
        return fs.readFileSync(resolvePath(input.path), "utf-8");
      } catch (error) {
        return colorize.error(`Error reading file: ${error}`);
      }
    }
    case "write_file": {
      if (input.content === undefined || input.content === null) {
        return colorize.error(`Error: content parameter is required but was not provided`);
      }
      try {
        fs.writeFileSync(resolvePath(input.path), input.content);
        return colorize.success(`✓ Written to ${input.path}`);
      } catch (error) {
        return colorize.error(`Error writing file: ${error}`);
      }
    }
    case "bash": {
      return new Promise((resolve) => {
        console.log(colorize.info(`⚡ Executing: ${input.command}`));
        const proc = spawn("bash", ["-c", input.command], { cwd });
        let stdout = "", stderr = "";
        
        proc.stdout.on("data", (d) => {
          const data = d.toString();
          stdout += data;
          // Show real-time output for long-running commands
          if (data.trim()) {
            process.stdout.write(colorize.dim(data));
          }
        });
        
        proc.stderr.on("data", (d) => {
          const data = d.toString();
          stderr += data;
          // Show real-time errors
          if (data.trim()) {
            process.stderr.write(colorize.error(data));
          }
        });
        
        proc.on("close", (code) => {
          const exitStatus = code === 0 
            ? colorize.success(`✓ Exit code: ${code}`)
            : colorize.error(`✗ Exit code: ${code}`);
          
          let result = exitStatus;
          if (stdout.trim()) result += `\n${stdout.trim()}`;
          if (stderr.trim()) result += `\n${colorize.error('Stderr:')} ${stderr.trim()}`;
          
          resolve(result);
        });
      });
    }
    case "grep_search": {
      try {
        const targetPath = resolvePath(input.path);
        const pattern = input.pattern;
        const recursive = input.recursive ?? true;
        const caseSensitive = input.case_sensitive ?? false;
        const fileExtensions = input.file_extensions || [];
        
        let regex: RegExp;
        try {
          regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
        } catch (error) {
          return colorize.error(`Invalid regex pattern: ${error}`);
        }
        
        const results: string[] = [];
        
        function searchInFile(filePath: string): void {
          try {
            const stats = fs.statSync(filePath);
            if (!stats.isFile()) return;
            
            // Check file extension filter
            if (fileExtensions.length > 0) {
              const fileExt = path.extname(filePath);
              if (!fileExtensions.includes(fileExt)) return;
            }
            
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            
            lines.forEach((line, index) => {
              const matches = line.match(regex);
              if (matches) {
                const relativePath = path.relative(cwd, filePath);
                const lineNumber = index + 1;
                const highlightedLine = line.replace(regex, (match) => colorize.highlight(match));
                results.push(`${colorize.file(relativePath)}:${colorize.info(lineNumber.toString())}:${highlightedLine}`);
              }
            });
          } catch (error) {
            // Skip files that can't be read (binary files, permission issues, etc.)
          }
        }
        
        function searchDirectory(dirPath: string): void {
          try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
              const fullPath = path.join(dirPath, entry.name);
              
              if (entry.isFile()) {
                searchInFile(fullPath);
              } else if (entry.isDirectory() && recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                searchDirectory(fullPath);
              }
            }
          } catch (error) {
            // Skip directories that can't be read
          }
        }
        
        const stats = fs.statSync(targetPath);
        if (stats.isFile()) {
          searchInFile(targetPath);
        } else if (stats.isDirectory()) {
          searchDirectory(targetPath);
        } else {
          return colorize.error(`Path is neither a file nor a directory: ${targetPath}`);
        }
        
        if (results.length === 0) {
          return colorize.warning(`No matches found for pattern: ${pattern}`);
        }
        
        const summary = colorize.success(`Found ${results.length} matches for pattern: ${pattern}`);
        return `${summary}\n\n${results.join('\n')}`;
        
      } catch (error) {
        return colorize.error(`Error during search: ${error}`);
      }
    }
    default: {
      return colorize.error(`Unknown tool: ${name}`);
    }
  }
}

async function runAgent(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage }];
  const systemPrompt = `You are a coding assistant. Working directory: ${cwd}. Use tools to help the user. Be concise.`;

  console.log(colorize.info("\n🤖 Processing your request...\n"));

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });

    let hasToolUse = false;
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        // Format the assistant's response with better styling
        if (block.text.trim()) {
          console.log(`${colorize.highlight("Assistant:")} ${block.text}\n`);
        }
      } else if (block.type === "tool_use") {
        hasToolUse = true;
        
        // Show tool execution with nice formatting
        console.log(`${colorize.toolName("🔧 " + block.name)}`);
        console.log(`${colorize.toolArgs("📝 Args: " + JSON.stringify(block.input, null, 2))}`);
        
        const result = await executeTool(block.name, block.input);
        
        // Format tool result
        const resultLines = result.split('\n');
        if (resultLines.length > 10) {
          // For long results, show first few and last few lines
          console.log(`${colorize.toolResult("📤 Result:")} ${colorize.dim("(showing truncated output)")}`);
          console.log(resultLines.slice(0, 5).join('\n'));
          console.log(colorize.dim("... (truncated) ..."));
          console.log(resultLines.slice(-3).join('\n'));
        } else {
          console.log(`${colorize.toolResult("📤 Result:")}`);
          console.log(result);
        }
        console.log(""); // Add spacing
        
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
    }

    messages.push({ role: "assistant", content: response.content });
    
    if (hasToolUse) {
      messages.push({ role: "user", content: toolResults });
    } else {
      // No more tool calls, we're done
      break;
    }
  }
}

// Interactive REPL
async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Clear screen and show awesome banner
  console.clear();
  
  // Display the cool DEV.BG AGENT banner
  console.log(createDevBgBanner());
  
  // Show welcome message with nice formatting
  console.log(createBox(
    `Welcome to the Enhanced Coding Agent!\n\nFeatures:\n• 🎨 Colorized output\n• 🔧 File operations\n• 🖥️  Shell commands\n• 📁 Directory browsing\n• 🔍 Pattern searching (grep)\n• 🇧🇬 Built for Bulgarian developers\n\nType your request or 'exit' to quit`,
    "🚀 Getting Started"
  ));
  
  console.log(`\n${colorize.workingDir("📍 Working directory:")} ${colorize.bold(cwd)}\n`);

  const prompt = () => {
    rl.question(colorize.prompt("❯ "), async (input) => {
      if (input.toLowerCase() === "exit") {
        console.log(colorize.success("\n👋 Довиждане! (Goodbye!)\n"));
        rl.close();
        return;
      }
      
      if (input.toLowerCase() === "clear") {
        console.clear();
        console.log(createDevBgBanner());
        prompt();
        return;
      }
      
      if (input.toLowerCase() === "help") {
        console.log(createBox(
          `Available commands:\n• Any coding question or request\n• 'clear' - Clear the screen and show banner\n• 'help' - Show this help\n• 'exit' - Quit the application\n\nThe agent can:\n• Read and write files\n• Execute shell commands\n• List directories\n• Search patterns in files (grep)\n• Help with coding tasks\n• Speak Bulgarian! 🇧🇬`,
          "📚 Help"
        ));
        console.log("");
        prompt();
        return;
      }
      
      if (input.trim()) {
        try {
          await runAgent(input);
        } catch (error) {
          console.log(colorize.error(`\n❌ Error: ${error}\n`));
        }
      }
      prompt();
    });
  };

  prompt();
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log(colorize.warning('\n\n⚠️  Interrupted! Use "exit" to quit cleanly.\n'));
});

main().catch((error) => {
  console.error(colorize.error(`\n💥 Fatal error: ${error}\n`));
  process.exit(1);
});