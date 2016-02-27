'use strict';

const express = require('express');
const app = express();

// 超!A&G番組表取得
const agqr = require('./lib/agqr');
let timetable = null;
agqr.downloadAndParseTimetable().then((response) => {
    timetable = response;
}).catch((error) => {
    console.log(error);
    process.exit(1);
});

// ルーティング
app.get('/', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    response.send(JSON.stringify(timetable, null, '  '));
});
app.get('/next', (request, response) => {
    try {
        response.json(agqr.getProgramInfo());
    } catch (error) {
        response.send(error.message);
    }
});
app.get('/now', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    agqr.getStreamingProgramInfo().then((info) => {
        response.send(JSON.stringify(info, null, '  '));
    }).catch((error) => {
        response.send(error);
    });;
});

// サーバ起動
const listenPort = process.env.PORT || 3000;
app.listen(listenPort, () => {
    console.log('start listening on port %d', listenPort);
});
