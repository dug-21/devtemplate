#!/bin/bash

echo "🔄 Resetting last check time..."

# Remove the last check file to force processing of all issues
rm -f .last-check

echo "✅ Last check time reset. Next run will process all open issues."