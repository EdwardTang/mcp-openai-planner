# MCP OpenAI Server

A Model Context Protocol (MCP) server that lets you seamlessly use OpenAI's models right from Claude.

## Features

- Direct integration with OpenAI's chat and planning models
- Support for multiple models including:
  - gpt-4o (chat)
  - gpt-4o-mini (chat)
  - o1-preview (planning)
  - o1-mini (planning)
  - o1 (advanced planning)
  - o3-mini (lightweight planning)
- Reasoning effort levels (low, medium, high)
- Simple message passing interface
- Basic error handling

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18 (includes `npm` and `npx`)
- [Claude Desktop app](https://claude.ai/download)
- [OpenAI API key](https://platform.openai.com/api-keys)

## Installation

First, make sure you've got the [Claude Desktop app](https://claude.ai/download) installed and you've requested an [OpenAI API key](https://platform.openai.com/api-keys).

Add this entry to your `claude_desktop_config.json` (on Mac, you'll find it at `~/Library/Application\ Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcp-openai-planner": {
      "command": "npx",
      "args": ["-y", "@edwardtang1024/mcp-openai-planner@latest"],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here (get one from https://platform.openai.com/api-keys)"
      }
    }
  }
}
```

This config lets Claude Desktop fire up the OpenAI MCP server whenever you need it.

## Usage

Leverage the multi-agent architecture inspired by [grapeot's planner-executor design](https://github.com/grapeot/devin.cursorrules/blob/multi-agent/.cursorrules) to optimize both reasoning quality and cost efficiency:

### Claude as Executor, o1 as Planner

The MCP server implements a streamlined multi-agent workflow where:
- **Claude (3.7 Sonnet)** automatically functions as your **Executor** agent
- **o1/o1-mini/o3-mini** serves as your dedicated **Planner** agent

This eliminates the need to manually switch roles - each model plays to its strengths:

```plaintext
# Just ask o1 for planning help directly
@o1 I need to design a system that processes large volumes of customer data while ensuring privacy compliance.

# Claude acts as the executor, o1 responds as the planner
```

**Automatic Executor-to-Planner Request Formatting:**

When you use the `openai_plan` tool with any o1 model, your message is automatically formatted as an executor request:

```plaintext
# Your simple input
@o1 How should I approach building a secure authentication system?

# Gets automatically formatted as
[EXECUTOR REQUEST]
Task: Project planning/implementation
Status: Seeking guidance
Question: How should I approach building a secure authentication system?

Please analyze this request and provide guidance on the next steps.
```

**Structured Requests for Better Planning:**

For more complex planning needs, you can use explicit request formatting:

```plaintext
@o1
Task: Implement OAuth2 authentication
Status: Blocked
Progress: Basic login flow implemented
Blocker: Unsure about token management strategy
Question: Should we use short-lived JWTs with refresh or longer expiration?
Context: Currently storing tokens in localStorage
```

**Cost-Optimized Multi-Agent Workflow:**

```plaintext
# Phase 1: Planning (o1 - $0.15/1k tokens)
- Problem decomposition
- Architecture design
- Risk assessment

# Phase 2: Implementation (Claude 3.7 - $0.03/1k tokens)
- Code writing
- Testing
- Documentation

# Phase 3: Targeted Planning (o3-mini - $0.015/1k tokens)
- Specific implementation questions
- Code optimization advice
- Cost-effective reasoning
```

**Key Benefits of This Architecture:**
- 💸 **90% Cost Reduction**: Use o1 only for critical planning decisions
- 🤖 **Automatic Role Assignment**: No need to explicitly switch between roles
- 🔄 **Contextual Prompting**: Messages automatically formatted for planning
- ⚡ **Faster Development**: Models specialized for their most efficient tasks

### Supported Models

The server currently supports these models:

- gpt-4o (default)
- gpt-4o-mini
- o1-preview
- o1-mini
- o1
- o3-mini

### Example Commands

```plaintext
# Basic planning request
@o1 How should we structure the database for a multi-tenant SaaS app?

# Planning with explicit task context
@o1
Task: Implement real-time notification system
Status: Starting implementation
Question: What's the best approach for handling WebSocket connections at scale?

# Cost-efficient targeted planning
@o3-mini
Task: Optimize API response times
Status: In progress
Context: Current response time is 1.2s for listing endpoints
Question: Which indexes should I add to improve query performance?

# Using different models for specific strengths
@gpt-4o Can you help me debug this React component?
@o1 Design a scalable architecture for this microservice
```

### Tools

1. `openai_chat`
   - Sends messages to OpenAI's chat completion API
   - Arguments: 
     - `messages`: Array of messages (required)
     - `model`: Which model to use (optional, defaults to gpt-4o)

2. `openai_plan`
   - Specialized tool for complex reasoning tasks and inter-agent communication
   - Arguments:
     - `messages`: Array of messages with developer role support (required)
     - `model`: Planning model to use (o1-preview, o1-mini, o1, o3-mini)
     - `reasoning_effort`: Cognitive effort level (low/medium/high, defaults to low)

## Problems

This is alpha software, so may have bugs. If you have an issue, check Claude Desktop's MCP logs:

```bash
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

## Development

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Watch for changes
pnpm watch

# Run in development mode
pnpm dev
```

## Requirements

- Node.js >= 18
- OpenAI API key

## Verified Platforms

- [x] macOS
- [x ] Linux

## License

MIT

## Authors

- [edwardtang](https://github.com/edwardtang) 🛠️ Current maintainer  
  _Building upon the foundations of:_  
  - [mzxrai](https://github.com/mzxrai) 🚀 Original MCP Server ([mcp-openai](https://github.com/mzxrai/mcp-openai))  
  - [grapeot](https://github.com/grapeot) 🤖 Multi-agent Architecture ([devin.cursorrules](https://github.com/grapeot/devin.cursorrules/tree/multi-agent))  

🙏 Grateful for the open source community's collective wisdom that made this project possible.