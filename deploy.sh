#!/bin/bash
echo "baixando atualizações..."
git pull
echo "atualizações baixadas..."
echo "deploy do backend..."
cd /home/deploy/sacmais/backend
rm -r dist
npm i
npm run build
echo "fim deploy do backend..."
echo "deploy do frontend..."
cd /home/deploy/sacmais/frontend
rm -r build
npm i
npm run build
npx sequelize db:migrate
echo "fim deploy do frontend..."
echo "restartando o PM2..."
pm2 restart all
echo "deploy finalizado."