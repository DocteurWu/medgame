@echo off
set LLM_API_KEY=YOUR_OPENROUTER_API_KEY
set LLM_MODEL=google/gemma-4-26b-a4b-it:free
cd /d C:\Users\Louai\Desktop\medgame-main
node scripts/generate_ecos_grilles.js > scripts\run-stdout.log 2> scripts\run-stderr.log
