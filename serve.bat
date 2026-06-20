@echo off
cd /d "%~dp0"
echo PEANUT RUN — serving at http://localhost:8137
start "" http://localhost:8137
python -m http.server 8137
