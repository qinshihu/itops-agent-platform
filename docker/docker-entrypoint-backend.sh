#!/bin/sh
# Entrypoint script for backend container
# Runs as root to fix volume permissions, then drops to appuser

# Ensure data directory exists and set proper ownership
mkdir -p /app/data
chown -R appuser:appgroup /app/data

# Drop privileges and run the application
exec gosu appuser "$@"
