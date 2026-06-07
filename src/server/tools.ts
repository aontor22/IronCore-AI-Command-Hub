import { FunctionDeclaration, Type } from '@google/genai';

export const webSearchTool: FunctionDeclaration = {
  name: "web_search",
  description: "Search the web for current or factual information.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query."
      }
    },
    required: ["query"]
  }
};

export const readFileTool: FunctionDeclaration = {
  name: "read_file",
  description: "Read the contents of a local file.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "The path of the file to read."
      }
    },
    required: ["path"]
  }
};

export const summarizeFileTool: FunctionDeclaration = {
  name: "summarize_file",
  description: "Read and summarize a local file.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      path: {
        type: Type.STRING,
        description: "The path of the file to summarize."
      }
    },
    required: ["path"]
  }
};

export const createTaskTool: FunctionDeclaration = {
  name: "create_task",
  description: "Create a new task or reminder.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The title of the task."
      },
      description: {
        type: Type.STRING,
        description: "A detailed description of the task."
      },
      dueDate: {
        type: Type.STRING,
        description: "Optional due date in ISO format, e.g., 2026-06-07T12:00:00Z."
      },
      priority: {
        type: Type.STRING,
        description: "Priority of the task: 'high', 'medium', or 'low'. Default is 'medium'."
      },
      category: {
        type: Type.STRING,
        description: "Category of the task: 'personal', 'work', or 'shopping'. Default is 'personal'."
      }
    },
    required: ["title"]
  }
};

export const saveMemoryTool: FunctionDeclaration = {
  name: "save_memory",
  description: "Save information to long-term memory about user preferences, facts, or context.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      content: {
        type: Type.STRING,
        description: "The information to save."
      }
    },
    required: ["content"]
  }
};

export const retrieveMemoryTool: FunctionDeclaration = {
  name: "retrieve_memory",
  description: "Search and retrieve facts from long-term memory.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The query to search memories for (optional, leave empty to get all recent memories)."
      }
    }
  }
};

export const draftEmailTool: FunctionDeclaration = {
  name: "draft_email",
  description: "Draft an email for the user. (Action requires confirmation).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: {
        type: Type.STRING,
        description: "Recipient email address."
      },
      subject: {
        type: Type.STRING,
        description: "Email subject."
      },
      body: {
        type: Type.STRING,
        description: "Email body content."
      }
    },
    required: ["to", "subject", "body"]
  }
};

export const searchCalendarTool: FunctionDeclaration = {
  name: "search_calendar",
  description: "Search the calendar for events.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      date: {
        type: Type.STRING,
        description: "The date to search for in YYYY-MM-DD format."
      }
    },
    required: ["date"]
  }
};

export const createCalendarEventTool: FunctionDeclaration = {
  name: "create_calendar_event",
  description: "Create a new calendar event.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "Event title."
      },
      date: {
        type: Type.STRING,
        description: "The date and time in ISO format."
      }
    },
    required: ["title", "date"]
  }
};

export const runCodeSafelyTool: FunctionDeclaration = {
  name: "run_code_safely",
  description: "Execute a JavaScript code snippet safely to calculate or format something.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      code: {
        type: Type.STRING,
        description: "The JavaScript code to evaluate. Should return a value."
      }
    },
    required: ["code"]
  }
};

// Also require an action execution handler on backend in \`ai.ts\`.
