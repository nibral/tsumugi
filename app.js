'use strict';

const express = require('express');
const app = express();

// ルーティング
app.get('/', (request, response) => {
    response.send('ok');
});

// サーバ起動
const listenPort = process.env.PORT || 3000;
app.listen(listenPort, () => {
    console.log('start listening on port %d', listenPort);
});

// 録画スケジューラ起動
const scheduler = require('./lib/scheduler');
scheduler.start();
