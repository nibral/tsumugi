'use strict';

const express = require('express');
const app = express();

// 超!A&G番組表取得
const agqr = require('./lib/agqr');

// ルーティング
app.get('/', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    agqr.downloadAndParseTimetable().then((timetable) => {
        response.send(JSON.stringify(timetable, null, '  '));
    }).catch((error) => {
        response.send(error);
    });
});
app.get('/now', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    agqr.downloadAndParseTimetable().then(() => {
        return agqr.getNowProgramFromTimetable();
    }).then((info) => {
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
app.get('/rec', (request, response) => {
    response.send('Recording request was accepted. Check your console.');

    const co = require('co');
    const sleep = require('sleep-promise');
    const Program = require('./lib/program');
    co(function* () {
        const streamUrl = yield agqr.getStreamUrl();
        const nowProgram = new Program();
        yield nowProgram.startRecording(streamUrl);
        yield sleep(30 * 1000);
        yield nowProgram.stopRecording();
        yield nowProgram.encodeRecordedFile();
        yield nowProgram.deleteRecordedFile();
        return nowProgram.info;
    }).then((result) => {
        console.log(result);
    }).catch((error) => {
        console.log(error);
    });
});
app.get('/check', (request, response) => {
    response.setHeader('Content-Type', 'text/plain');
    const co = require('co');
    co(function* () {
        yield agqr.downloadAndParseTimetable();
        const fromTable = yield agqr.getNowProgramFromTimetable();
        const fromStream = yield agqr.getStreamingProgramInfo();
        const isMatch =
            agqr.isScheduledProgram(fromTable.now.title, fromStream.title);
        response.send(fromTable.now.title + ',' + fromStream.title + ',' + isMatch);
    }).catch((error) => {
        response.send(error);
    });
});

// 録画スケジューラ起動
const scheduler = require('./lib/scheduler');
scheduler.start();

// サーバ起動
const listenPort = process.env.PORT || 3000;
app.listen(listenPort, () => {
    console.log('start listening on port %d', listenPort);
});
