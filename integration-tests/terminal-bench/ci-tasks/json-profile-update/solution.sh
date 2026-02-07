#!/bin/bash
cat > /app/profile.json <<'JSON'
{
  "name": "Papert Bot",
  "role": "coding-agent",
  "skills": ["refactor", "testing", "documentation"],
  "active": true
}
JSON
