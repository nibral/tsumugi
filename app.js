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
});

// ルーティング
app.get('/', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    response.send(JSON.stringify(timetable, null, '  '));
});
app.get('/now', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    agqr.getProgramInfo(timetable).then((info) => {
        response.send(JSON.stringify(info, null, '  '));
    }).catch((error) => {
        response.send(error);
    });
});
app.get('/stream', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    agqr.getStreamingProgramInfo().then((info) => {
        response.send(JSON.stringify(info, null, '  '));
    }).catch((error) => {
        response.send(error);
    });
});

// サーバ起動
const listenPort = process.env.PORT || 3000;
app.listen(listenPort, () => {
    console.log('start listening on port %d', listenPort);
});

const sleep = require('sleep-promise');
const Recorder = require('./lib/recorder');
let recJob = null;
agqr.getStreamUrl().then((url) => {
    recJob = new Recorder(url);
    return recJob.start();
}).then(() => {
    return sleep(10 * 1000);
}).then(() => {
    return recJob.stop(false);
}).then(() => {
    console.log('rec ok');    
}).catch((error) => {
    console.log(error);
});
