#!/bin/bash

set -e

echo "📦 Setting up spec-forge git repo and pushing to GitHub..."

cd /home/joe/dev/portfolio-projects/12-spec-forge

# Initialize git
echo "🔧 Initializing git repository..."
git init
git config user.email "copilot@github.com"
git config user.name "Copilot"

# Create .gitignore if not present (already done but confirm)
if [ ! -f .gitignore ]; then
  echo "⚠️  .gitignore missing, this should already exist"
fi

# Add all files
echo "📝 Staging files..."
git add .

# Commit
echo "💾 Creating initial commit..."
git commit -m "Phase 1: Angular 20.3 shell and core types

- Angular 20.3 standalone components with strict TypeScript
- Core types: Answer, Block, Origin, Question, Trigger
- Nine base interview steps with validation
- AppComponent shell with header and step rail
- Full test suite (core types, steps, validation)
- Package layout: core, templates, model, state, persistence, ui
- All npm scripts: typecheck, test, build, lint
- TypeScript strict mode + strictTemplates
- Ready for Phase 2 (trigger engine and autosave)

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

# Create remote repo with gh
echo "🚀 Creating GitHub repository..."
gh repo create spec-forge \
  --public \
  --source=. \
  --remote=origin \
  --push \
  --description "A 100% client-side Angular 20.3 app that interviews users about an idea and produces three markdown files: proposal.md, design.md, tasks.md"

echo "✅ Done! Repository created and pushed to GitHub"
echo ""
echo "Repository URL: https://github.com/$(gh api user -q .login)/spec-forge"
git log --oneline | head -5
