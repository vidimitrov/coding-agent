// ANSI color codes
export const colors = {
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright text colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  
  // Styles
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  reverse: '\x1b[7m',
  strikethrough: '\x1b[9m',
};

// Utility functions for colored text
export const colorize = {
  error: (text: string) => `${colors.brightRed}${text}${colors.reset}`,
  success: (text: string) => `${colors.brightGreen}${text}${colors.reset}`,
  warning: (text: string) => `${colors.brightYellow}${text}${colors.reset}`,
  info: (text: string) => `${colors.brightBlue}${text}${colors.reset}`,
  debug: (text: string) => `${colors.brightBlack}${text}${colors.reset}`,
  highlight: (text: string) => `${colors.brightCyan}${text}${colors.reset}`,
  bold: (text: string) => `${colors.bold}${text}${colors.reset}`,
  dim: (text: string) => `${colors.dim}${text}${colors.reset}`,
  underline: (text: string) => `${colors.underline}${text}${colors.reset}`,
  
  // Tool-specific colors
  toolName: (text: string) => `${colors.bold}${colors.brightMagenta}${text}${colors.reset}`,
  toolArgs: (text: string) => `${colors.dim}${colors.cyan}${text}${colors.reset}`,
  toolResult: (text: string) => `${colors.green}${text}${colors.reset}`,
  prompt: (text: string) => `${colors.bold}${colors.brightCyan}${text}${colors.reset}`,
  workingDir: (text: string) => `${colors.dim}${colors.yellow}${text}${colors.reset}`,
  
  // File type colors
  directory: (text: string) => `${colors.bold}${colors.blue}${text}${colors.reset}`,
  file: (text: string) => `${colors.white}${text}${colors.reset}`,
  executable: (text: string) => `${colors.brightGreen}${text}${colors.reset}`,
};

// Box drawing characters for better UI
export const box = {
  horizontal: '─',
  vertical: '│',
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  cross: '┼',
  teeUp: '┴',
  teeDown: '┬',
  teeLeft: '┤',
  teeRight: '├',
};

// Create a bordered box around text
export function createBox(text: string, title?: string): string {
  const lines = text.split('\n');
  const maxLength = Math.max(...lines.map(line => line.length), title?.length || 0);
  const width = maxLength + 2;
  
  let result = '';
  
  // Top border
  if (title) {
    const titlePadding = Math.floor((width - title.length) / 2);
    const titleLine = title.padStart(titlePadding + title.length).padEnd(width);
    result += `${colors.dim}${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}${colors.reset}\n`;
    result += `${colors.dim}${box.vertical}${colors.reset}${colorize.bold(titleLine)}${colors.dim}${box.vertical}${colors.reset}\n`;
    result += `${colors.dim}${box.teeRight}${box.horizontal.repeat(width)}${box.teeLeft}${colors.reset}\n`;
  } else {
    result += `${colors.dim}${box.topLeft}${box.horizontal.repeat(width)}${box.topRight}${colors.reset}\n`;
  }
  
  // Content
  for (const line of lines) {
    result += `${colors.dim}${box.vertical}${colors.reset} ${line.padEnd(maxLength)} ${colors.dim}${box.vertical}${colors.reset}\n`;
  }
  
  // Bottom border
  result += `${colors.dim}${box.bottomLeft}${box.horizontal.repeat(width)}${box.bottomRight}${colors.reset}`;
  
  return result;
}

// Cool ASCII Art Banner for DEV.BG AGENT
export function createDevBgBanner(): string {
  const banner = `
${colors.brightCyan}██████╗ ███████╗██╗   ██╗   ██████╗  ██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗
${colors.brightBlue}██╔══██╗██╔════╝██║   ██║   ██╔══██╗██╔════╝     ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
${colors.brightMagenta}██║  ██║█████╗  ██║   ██║   ██████╔╝██║  ███╗    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
${colors.brightYellow}██║  ██║██╔══╝  ╚██╗ ██╔╝   ██╔══██╗██║   ██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
${colors.brightRed}██████╔╝███████╗ ╚████╔╝ ██╗██████╔╝╚██████╔╝    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
${colors.brightGreen}╚═════╝ ╚══════╝  ╚═══╝  ╚═╝╚═════╝  ╚═════╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
${colors.reset}`;

  const subtitle = `${colors.dim}${colors.italic}🤖 Your AI-Powered Development Assistant for Bulgarian Developers 🇧🇬${colors.reset}`;
  const version = `${colors.dim}v2.0 - Enhanced with Claude Sonnet${colors.reset}`;
  
  return banner + '\n' + ' '.repeat(25) + subtitle + '\n' + ' '.repeat(35) + version + '\n';
}