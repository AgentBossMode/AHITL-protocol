#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Kill all background processes on exit
trap "trap - SIGTERM && kill -- -$$" SIGINT SIGTERM EXIT

# Get the absolute path of the script's directory
ROOT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# --- Frontend Setup ---
echo "--- Installing frontend dependencies ---"
cd "$ROOT_DIR/ahitl"
npm install

# --- Agent Setup ---
echo "--- Setting up agent environment ---"
cd "$ROOT_DIR/ahitl/agent"

# Check if uv is installed
if ! command -v uv &> /dev/null
then
    echo "uv could not be found, please install it first."
    echo "See https://github.com/astral-sh/uv for installation instructions."
    exit 1
fi

# Initialize project only if pyproject.toml does not exist
if [ ! -f "pyproject.toml" ]; then
  echo "pyproject.toml not found, running uv init..."
  uv init
fi

uv sync

# --- Start Services ---
echo "--- Starting UI and Agent --- "

# Start the UI in the background
(cd "$ROOT_DIR/dgui" && npm run dev) &

# Activate agent environment and start agent in the foreground
(cd "$ROOT_DIR/dgui/agent" && source .venv/bin/activate && langgraph dev --port 8123)
