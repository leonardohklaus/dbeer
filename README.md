# DBeer

**Natural language database client** — query your databases in plain English (or Portuguese) without writing SQL.

DBeer is a desktop app built with Electron that translates natural language into read-only SQL queries using Claude (Anthropic). Just describe what you want to see, and DBeer generates and runs the query for you.

## Features

- **Natural language to SQL** — powered by Claude via the Anthropic API
- **Read-only by design** — two-layer enforcement (AI prompt + `sql-guard` regex blacklist) blocks any INSERT, UPDATE, DELETE, DDL, or administrative statement
- **Multi-database support** — PostgreSQL, MySQL, SQL Server, Oracle, SQLite
- **Schema-aware** — automatically introspects tables, columns, primary/foreign keys, and views so Claude generates accurate queries
- **Data visualization** — ask for a chart and get bar, line, area, pie, scatter, or horizontal bar charts rendered with Recharts
- **Conversation context** — follow-up questions reference previous queries (last 6 turns)
- **Query history** — persistent history with favorites
- **Multiple connections** — manage and switch between connections with color labels

## Supported Databases

| Database   | Driver         |
|------------|----------------|
| PostgreSQL | `pg`           |
| MySQL      | `mysql2`       |
| SQL Server | `mssql`        |
| Oracle     | `oracledb`     |
| SQLite     | `better-sqlite3` |

## Requirements

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/)

## Getting Started

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Open the app (in another terminal or wait for Electron to launch)
npm start
```

On first launch, open **Settings** and enter your Anthropic API key.

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

1. **AI prompt** — Claude is instructed to only generate `SELECT`, `WITH`, `SHOW`, `DESCRIBE`, and `EXPLAIN` statements and to refuse any write request
2. **`sql-guard`** — a regex-based validator runs before every query reaches the database driver, blocking forbidden statements (INSERT, UPDATE, DELETE, CREATE, DROP, EXEC, etc.) and multi-statement attacks

## Tech Stack

- **Electron** — desktop shell
- **React + TypeScript** — renderer UI
- **Tailwind CSS** — styling
- **Vite** — renderer bundler
- **Anthropic SDK** — Claude integration
- **Recharts** — data visualization
- **electron-store** — persistent settings and history

## License

MIT
