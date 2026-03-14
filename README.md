# DBeer

**Natural language database client** — query your databases in plain English (or Portuguese) without writing SQL.

DBeer is a desktop app built with Electron that translates natural language into read-only SQL queries using the AI provider of your choice. Just describe what you want to see, and DBeer generates and runs the query for you.

## Features

- **Natural language to SQL** — choose your AI provider: Anthropic Claude, OpenAI, Google Gemini, Groq, or Ollama (local)
- **Read-only by design** — two-layer enforcement (AI prompt + `sql-guard` regex blacklist) blocks any INSERT, UPDATE, DELETE, DDL, or administrative statement, regardless of which AI provider is used
- **Multi-database support** — PostgreSQL, MySQL, SQL Server, Oracle, SQLite
- **Schema-aware** — automatically introspects tables, columns, primary/foreign keys, and views so the model generates accurate queries
- **Data visualization** — ask for a chart and get bar, line, area, pie, scatter, or horizontal bar charts rendered with Recharts
- **Conversation context** — follow-up questions reference previous queries (last 6 turns)
- **Query history** — persistent history with favorites
- **Multiple connections** — manage and switch between connections with color labels

## Supported Databases

| Database   | Driver           |
|------------|------------------|
| PostgreSQL | `pg`             |
| MySQL      | `mysql2`         |
| SQL Server | `mssql`          |
| Oracle     | `oracledb`       |
| SQLite     | `better-sqlite3` |

## AI Providers

DBeer supports five AI providers. Switch between them at any time in **Settings** — the read-only SQL guard applies to all of them.

### Anthropic Claude
The original provider. Claude models are excellent at following strict formatting instructions and refusing disallowed operations, making them a natural fit for DBeer's read-only enforcement.

| Model | Description |
|-------|-------------|
| Claude Sonnet 4 | Recommended. Best balance of speed and capability |
| Claude Opus 4 | Most capable, best for complex multi-join queries |
| Claude Haiku 4.5 | Fastest and cheapest |

**Requires:** API key from [console.anthropic.com](https://console.anthropic.com)

---

### OpenAI
The GPT family. Well-established models with strong SQL generation and support for `json_object` response format, which improves reliability.

| Model | Description |
|-------|-------------|
| GPT-4o | Recommended. Fast and highly capable |
| GPT-4o mini | Cheapest option, good for simple queries |
| o3-mini | Reasoning model, best for complex analytical queries |

**Requires:** API key from [platform.openai.com](https://platform.openai.com)

---

### Google Gemini
Google's multimodal models. Gemini 2.0 Flash is remarkably fast with a large context window, useful when connected to databases with many tables.

| Model | Description |
|-------|-------------|
| Gemini 2.0 Flash | Recommended. Ultra-fast with a 1M token context |
| Gemini 1.5 Pro | Most capable Gemini model |
| Gemini 1.5 Flash | Lightweight and fast |

**Requires:** API key from [Google AI Studio](https://aistudio.google.com)

---

### Groq
Groq runs open-source LLMs on custom LPU hardware, delivering inference speeds far beyond GPU-based providers. It offers a **free tier** with generous rate limits — ideal for trying DBeer without any cost.

| Model | Description |
|-------|-------------|
| Llama 3.3 70B | Recommended. Best quality on Groq |
| Llama 3.1 8B Instant | Ultra-fast, great for simple queries |
| Llama 3 70B | Solid general-purpose model |
| Mixtral 8x7B | Good at structured output and SQL |
| Gemma 2 9B | Lightweight alternative |

**Requires:** Free API key from [console.groq.com](https://console.groq.com)

---

### Ollama (Local)
Run models entirely on your own machine — no API key, no data leaves your computer. Requires [Ollama](https://ollama.com) to be installed and running locally.

Any model available in Ollama can be used. Recommended for SQL generation:

| Model | Pull command |
|-------|-------------|
| Llama 3.3 | `ollama pull llama3.3` |
| DeepSeek Coder V2 | `ollama pull deepseek-coder-v2` |
| Mistral | `ollama pull mistral` |
| Codestral | `ollama pull codestral` |

The default base URL is `http://localhost:11434`. Change it in Settings if Ollama runs on a different host or port.

**Requires:** [Ollama](https://ollama.com) running locally — no API key needed

---

## Requirements

- Node.js 18+
- One of the above AI providers (Ollama for fully offline usage)

## Getting Started

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Open the app (in another terminal or wait for Electron to launch)
npm start
```

On first launch, open **Settings**, choose your AI provider, and enter the corresponding API key.

## Build

```bash
# Build for current platform
npm run package

# Platform-specific builds
npm run package:mac
npm run package:win
npm run package:linux

# All platforms
npm run package:all
```

Packaged apps are output to `release/`.

## Usage

1. **Add a connection** — click the `+` button in the sidebar and fill in the connection details
2. **Connect** — select a connection; DBeer introspects the schema automatically
3. **Ask a question** — type in plain language, e.g. *"Show me the top 10 customers by total revenue"*
4. **Get results** — DBeer generates the SQL, runs it, and displays the results
5. **Visualize** — add "as a bar chart" or "show me a line graph" to your question to get a visualization

## Security Model

DBeer enforces read-only access at two independent layers:

1. **AI prompt** — every provider is instructed via system prompt to only generate `SELECT`, `WITH`, `SHOW`, `DESCRIBE`, and `EXPLAIN` statements, and to refuse any write request
2. **`sql-guard`** — a regex-based validator runs before every query reaches the database driver, blocking forbidden statements (INSERT, UPDATE, DELETE, CREATE, DROP, EXEC, etc.) and multi-statement attacks

Even if a model ignores the prompt instructions, the SQL guard prevents the query from executing.

## Tech Stack

- **Electron** — desktop shell
- **React + TypeScript** — renderer UI
- **Tailwind CSS** — styling
- **Vite** — renderer bundler
- **@anthropic-ai/sdk** — Claude integration
- **openai** — OpenAI, Groq, and Ollama integration (all use OpenAI-compatible APIs)
- **@google/generative-ai** — Google Gemini integration
- **Recharts** — data visualization
- **electron-store** — persistent settings and history

## License

MIT
