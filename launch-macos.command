#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies, this may take a minute..."
  npm install
fi

echo "Starting Step Recorder..."
npm start
