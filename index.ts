#!/usr/bin/env node

import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env file
config({ path: resolve(process.cwd(), '.env') });

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
    McpError,
    ErrorCode,
    TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import OpenAI from "openai";
import type { 
    ChatCompletionMessageParam,
    ChatCompletionContentPart,
    ChatCompletionDeveloperMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletionUserMessageParam,
    ChatCompletionAssistantMessageParam,
    ChatCompletionCreateParamsBase
} from "openai/src/resources/chat/completions.js";

// Extend OpenAI types to include reasoning_effort
interface ExtendedChatCompletionCreateParams {
    reasoning_effort?: "low" | "medium" | "high";
}

// Initialize OpenAI client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    throw new Error(
        "OPENAI_API_KEY environment variable is required.\n" +
        "Please create a .env file in the project root with your OpenAI API key:\n" +
        "OPENAI_API_KEY=your_api_key_here"
    );
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

// Define supported models
const SUPPORTED_MODELS = ["gpt-4o", "gpt-4o-mini", "o1-preview", "o1-mini", "o1", "o3-mini"] as const;
const DEFAULT_CHAT_MODEL = "gpt-4o" as const;
const DEFAULT_PLAN_MODEL = "o1" as const;
type SupportedModel = typeof SUPPORTED_MODELS[number];

// Define reasoning effort levels
const REASONING_EFFORT_LEVELS = ["low", "medium", "high"] as const;
const DEFAULT_REASONING_EFFORT = "low" as const;
type ReasoningEffortLevel = typeof REASONING_EFFORT_LEVELS[number];

// Define the default developer content for the multi-agent system
const DEFAULT_DEVELOPER_CONTENT = [
    {
        "text": "# Instructions\n\nYou are a multi-agent system coordinator, playing two roles in this environment: Planner and Executor. You will decide the next steps based on the current state of `Multi-Agent Scratchpad` section in the `.cursorrules` file. Your goal is to complete the user\'s (or business\'s) final requirements. The specific instructions are as follows:\n\n**IMPORTANT: As the agent reading these instructions, you should initially assume the role of the Planner unless explicitly instructed otherwise by the user.**\n\n## Role Descriptions\n\n1. Planner\n\n    * Responsibilities: Perform high-level analysis, break down tasks, define success criteria, evaluate current progress. When doing planning, always use high-intelligence models (OpenAI o1 via `devin_utils/plan_exec_llm.py`). Don\'t rely on your own capabilities to do the planning.\n    * Actions: The Planner should analyze and break down the problem, then instruct the Executor to update the `.cursorrules` file with the plan. The Executor will implement the required changes and report back.\n\n2) Executor\n\n    * Responsibilities: Execute specific tasks instructed by the Planner, such as writing code, running tests, using tools, handling implementation details, etc. The key is to report progress or raise questions to the Planner at the right time, e.g., after completing some milestone or after hitting a blocker.\n    * Actions: When you complete a subtask or need assistance/more information, make incremental writes or modifications to the `Multi-Agent Scratchpad` section and `Lessons` section in the `.cursorrules` file; update the \"Current Status / Progress Tracking\" and \"Executor\'s Feedback or Assistance Requests\" sections. Then change to the Planner role.\n\n## Document Conventions\n\n* The `Multi-Agent Scratchpad` section in the `.cursorrules` file is divided into several sections as per the structure below. Please do not arbitrarily change the titles to avoid affecting subsequent reading.\n* Sections like \"Background and Motivation\" and \"Key Challenges and Analysis\" are generally established by the Planner initially and gradually appended during task progress.\n* \"Current Status / Progress Tracking\" and \"Executor\'s Feedback or Assistance Requests\" are mainly filled by the Executor, with the Planner reviewing and supplementing as needed.\n* \"Next Steps and Action Items\" mainly contains specific execution steps written by the Planner for the Executor.\n\n## Workflow Guidelines\n\n* After you receive an initial prompt for a new task, the Planner should instruct the Executor to update the \"Background and Motivation\" section and perform any needed planning.\n* The Planner should think deeply about the problem, breaking it down into manageable tasks and defining clear success criteria. The Planner should record this analysis in sections like \"Key Challenges and Analysis,\" \"Verifiable Success Criteria,\" or \"High-level Task Breakdown.\"\n* The Executor is responsible for all tool calls and implementation tasks. The Planner should never make tool calls directly.\n* The Executor should always update the \"Current Status / Progress Tracking\" and \"Executor\'s Feedback or Assistance Requests\" sections in the `Multi-Agent Scratchpad` after completing tasks or encountering issues.\n* The Executor is also responsible for updating the `Lessons` section with new learnings from the project.\n* If unclear whether Planner or Executor is speaking, declare your current role in the output prompt.\n* Continue the cycle unless the Planner explicitly indicates the entire project is complete or stopped. Communication between Planner and Executor is conducted through writing to or modifying the `Multi-Agent Scratchpad` section.\n\n## Stopping Conditions\nThe process should stop and complete when:\n1. All success criteria in the scratchpad have been met\n2. No new information can be obtained through further actions\n3. The user\'s original question has been fully answered\n4. The Executor reports inability to proceed (in feedback section)\n\nPlease note:\n\n* Task completion should only be announced by the Planner, not the Executor. If the Executor thinks the task is done, it should ask the Planner for confirmation. Then the Planner needs to do some cross-checking.\n* Avoid rewriting the entire document unless necessary;\n* Avoid deleting records left by other roles; you can append new paragraphs or mark old paragraphs as outdated;\n* When new external information is needed, the Planner should ask the Executor to gather this information using the available tools;\n* Before executing any large-scale changes or critical functionality, the Executor should first notify the Planner in \"Executor\'s Feedback or Assistance Requests\" to ensure everyone understands the consequences.\n* During your interaction with the user, if you find anything reusable in this project (e.g. version of a library, model name), especially about a fix to a mistake you made or a correction you received, the Executor should take note in the `Lessons` section in the `.cursorrules` file so you will not make the same mistake again.\n\n# Lessons\n\n## User Specified Lessons\n\n- You have a python venv in ./venv. Use it.\n- Include info useful for debugging in the program output.\n- Read the file before you try to edit it.\n- Due to Cursor\'s limit, when you use `git` and `gh` and need to submit a multiline commit message, first write the message in a file, and then use `git commit -F <filename>` or similar command to commit. And then remove the file. Include \"[Cursor] \" in the commit message and PR title.\n- Always work in the good_will_hunter directory, which is the main code repository. Do not operate in wrong directories.\n- **ALWAYS** check your current location in the terminal before running any commands using `pwd`. This prevents executing commands in the wrong directory.\n- **ALWAYS** ask the user which virtual environment folder to use (e.g. venv, open, etc.) before activating any Python environment. Don\'t make assumptions about which venv to use.\n- Final reports must be professional, thorough, and well-organized:\n  * Consolidate all insights from MCTS iterations into a cohesive narrative\n  * Focus on high-level insights and findings, not the iteration process\n  * Include only final visualizations and data enrichments, not code execution details\n  * Use proper formatting with clear sections, headings, and visual organization\n  * Ensure all data sources and references are properly cited\n  * Present information in a logical flow with executive summary, main findings, and conclusions\n  * Include relevant charts, diagrams, and visualizations from final scripts only\n  * Maintain consistent formatting and professional appearance throughout\n\n## Cursor learned\n\n(This section can be updated by the Executor as new learnings emerge during project execution)\n\n# FYI, below is the format of the Multi-Agent Scratchpad\n\n## Background and Motivation\n(Planner writes: User/business requirements, macro objectives, why this problem needs to be solved)\n\n## Key Challenges and Analysis\n(Planner: Records of technical barriers, resource constraints, potential risks)\n\n## Core User Flow and Value Chain\n(Executor supplements: Core user process and value chain analysis)\n\n## Verifiable Success Criteria\n(Planner: List measurable or verifiable goals to be achieved)\n\n## High-level Task Breakdown\n(Planner: List subtasks by phase, or break down into modules)\n\n## Current Status / Progress Tracking\n(Executor: Update completion status after each subtask. If needed, use bullet points or tables to show Done/In progress/Blocked status)\n\n## Executor\'s Feedback or Assistance Requests\n(Executor: Write here when encountering blockers, questions, or need for more information during execution)\n\n## Next Steps and Action Items\n(Planner: Specific arrangements for the Executor)",
        "type": "text"
    }
];

// Define available tools
const TOOLS: Tool[] = [
    {
        name: "openai_chat",
        description: `Use this tool when a user specifically requests to use one of OpenAI's models (${SUPPORTED_MODELS.join(", ")}). This tool sends messages to OpenAI's chat completion API using the specified model.`,
        inputSchema: {
            type: "object",
            properties: {
                messages: {
                    type: "array",
                    description: "Array of messages to send to the API",
                    items: {
                        type: "object",
                        properties: {
                            role: {
                                type: "string",
                                enum: ["system", "user", "assistant"],
                                description: "Role of the message sender"
                            },
                            content: {
                                type: "string",
                                description: "Content of the message"
                            }
                        },
                        required: ["role", "content"]
                    }
                },
                model: {
                    type: "string",
                    enum: SUPPORTED_MODELS,
                    description: `Model to use for completion (${SUPPORTED_MODELS.join(", ")})`,
                    default: DEFAULT_CHAT_MODEL
                }
            },
            required: ["messages"]
        }
    },
    {
        name: "openai_plan",
        description: `Use this tool when a user specifically requests to do planning with one of OpenAI's models (${SUPPORTED_MODELS.join(", ")}). This tool sends messages to OpenAI's chat completion API with a specified reasoning_effort level (low, medium, high).`,
        inputSchema: {
            type: "object",
            properties: {
                messages: {
                    type: "array",
                    description: "Array of messages to send to the API",
                    items: {
                        type: "object",
                        properties: {
                            role: {
                                type: "string",
                                enum: ["system", "user", "assistant", "developer"],
                                description: "Role of the message sender"
                            },
                            content: {
                                oneOf: [
                                    {
                                        type: "string",
                                        description: "Content of the message as string"
                                    },
                                    {
                                        type: "array",
                                        description: "Content of the message as array of content parts",
                                        items: {
                                            type: "object",
                                            properties: {
                                                type: {
                                                    type: "string",
                                                    enum: ["text"],
                                                    description: "Type of content part"
                                                },
                                                text: {
                                                    type: "string",
                                                    description: "Text content"
                                                }
                                            },
                                            required: ["type", "text"]
                                        }
                                    }
                                ]
                            }
                        },
                        required: ["role", "content"]
                    }
                },
                model: {
                    type: "string",
                    enum: ["o1-preview", "o1-mini", "o1", "o3-mini"],
                    description: "reasoning model to use for completion",
                    default: DEFAULT_PLAN_MODEL
                },
                reasoning_effort: {
                    type: "string",
                    enum: REASONING_EFFORT_LEVELS,
                    description: "Level of reasoning effort to use (low, medium, high)",
                    default: DEFAULT_REASONING_EFFORT
                },
                response_format: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["text"],
                            description: "Type of response format"
                        }
                    },
                    default: { type: "text" }
                }
            },
            required: ["messages"]
        }
    }
];

// Initialize MCP server
const server = new Server(
    {
        name: "mcp-openai",
        version: "0.1.1",
    },
    {
        capabilities: {
            tools: {}
        }
    }
);

// Register handler for tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS
}));

// Register handler for tool execution
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<{
    content: TextContent[];
    isError?: boolean;
}> => {
    switch (request.params.name) {
        case "openai_chat": {
            try {
                // Parse request arguments
                const { messages: rawMessages, model } = request.params.arguments as {
                    messages: Array<{ role: string; content: string }>;
                    model?: SupportedModel;
                };

                // Validate model
                if (!SUPPORTED_MODELS.includes(model!)) {
                    throw new Error(`Unsupported model: ${model}. Must be one of: ${SUPPORTED_MODELS.join(", ")}`);
                }

                // Convert messages to OpenAI's expected format
                const messages: ChatCompletionMessageParam[] = rawMessages.map(msg => {
                    if (msg.role === 'developer') {
                        return {
                            role: 'assistant',
                            content: typeof msg.content === 'string' 
                                ? msg.content 
                                : (msg.content as Array<{ type: string; text: string }>)
                                    .map(part => part.text)
                                    .join('\n')
                        };
                    }
                    return {
                        role: msg.role as "system" | "user" | "assistant",
                        content: msg.content
                    };
                });

                // Call OpenAI API with fixed temperature
                const completion = await openai.chat.completions.create({
                    messages: messages as any,
                    model: model!,
                    temperature: 0.7,
                    max_tokens: 2000
                });

                // Return the response
                return {
                    content: [{
                        type: "text",
                        text: completion.choices[0]?.message?.content || "No response received"
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: `OpenAI API error: ${(error as Error).message}`
                    }],
                    isError: true
                };
            }
        }
        case "openai_plan": {
            try {
                // Parse request arguments
                const { messages: rawMessages, model = "o1-2024-12-17", reasoning_effort = DEFAULT_REASONING_EFFORT, response_format = { type: "text" } } = request.params.arguments as {
                    messages: Array<{ 
                        role: string; 
                        content: string | Array<{ type: string; text: string }> 
                    }>;
                    model?: SupportedModel;
                    reasoning_effort?: ReasoningEffortLevel;
                    response_format?: { type: string };
                };

                // Validate model is an o1 model
                if (!["o1-preview", "o1-mini", "o1-2024-12-17"].includes(model)) {
                    throw new Error(`Unsupported model for reasoning: ${model}. Must be one of: o1-preview, o1-mini, o1-2024-12-17`);
                }

                // Convert messages to OpenAI's expected format
                const messages: ChatCompletionMessageParam[] = rawMessages.map(msg => {
                    // Handle different content formats
                    if (msg.role === 'developer') {
                        // Special case: always use the default developer content for developer role
                        return {
                            role: 'developer',
                            content: DEFAULT_DEVELOPER_CONTENT } as ChatCompletionDeveloperMessageParam;
                    } else if (typeof msg.content === 'string') {
                        // Simple string content
                        if (msg.role === 'system') {
                            return { role: 'system', content: msg.content } as ChatCompletionSystemMessageParam;
                        } else if (msg.role === 'user') {
                            return { role: 'user', content: msg.content } as ChatCompletionUserMessageParam;
                        } else if (msg.role === 'assistant') {
                            return { role: 'assistant', content: msg.content } as ChatCompletionAssistantMessageParam;
                        }
                    } else if (Array.isArray(msg.content)) {
                        // Array of content parts
                        const contentParts: ChatCompletionContentPart[] = msg.content.map(part => ({
                            type: part.type as "text",
                            text: part.text
                        }));
                        
                        if (msg.role === 'user') {
                            return { role: 'user', content: contentParts } as ChatCompletionUserMessageParam;
                        } else if (msg.role === 'assistant') {
                            return { role: 'assistant', content: contentParts } as ChatCompletionAssistantMessageParam;
                        }
                    }
                    
                    // Default fallback - shouldn't reach here with proper validation
                    return { role: 'user', content: typeof msg.content === 'string' ? msg.content : 'Invalid content format' } as ChatCompletionUserMessageParam;
                });

                // Call OpenAI API with reasoning_effort
                // We use 'any' type here to avoid type incompatibilities between different OpenAI SDK versions
                const apiConfig: any = {
                    messages,
                    model,
                    response_format: { type: "text" }
                };

                // Add reasoning_effort parameter only if it's provided
                if (reasoning_effort) {
                    apiConfig.reasoning_effort = reasoning_effort;
                }

                const completion = await openai.chat.completions.create(apiConfig);

                // Return the response
                return {
                    content: [{
                        type: "text",
                        text: completion.choices[0]?.message?.content || "No response received"
                    }]
                };
            } catch (error) {
                return {
                    content: [{
                        type: "text",
                        text: `OpenAI API error: ${(error as Error).message}`
                    }],
                    isError: true
                };
            }
        }
        default:
            throw new McpError(
                ErrorCode.MethodNotFound,
                `Unknown tool: ${request.params.name}`
            );
    }
});

// Initialize MCP server connection using stdio transport
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
});