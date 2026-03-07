@echo off
cd /d "d:\connectsphere1\frontend\app\api\posts"
mkdir "[id]"
move "%%5Bid%%5D\route.ts" "[id]\route.ts"
rd /s /q "%%5Bid%%5D"
