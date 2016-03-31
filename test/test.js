'use strict';

/*eslint-disable */

const co = require('co');

co(function* () {
    /*
        /lib/agqr.js
    */
    const agqr = require('../lib/agqr');
    console.log('[  agqr.js  ]');

    // 番組表取得
    console.log('downloadAndParseTimetable()');
    const timetable = yield agqr.downloadAndParseTimetable();
    console.log('timetable width = ' + Object.keys(timetable).length);

    // 放送中番組取得
    console.log('getNowProgramFromTimetable()');
    const programs = agqr.getProgramInfoFromTimetable();
    console.log(programs);

    // 配信画面取得
    console.log('getStreamingProgramInfo()');
    const streamProgram = yield agqr.getStreamingProgramInfo();
    console.log(streamProgram);

    // 配信URL取得
    console.log('getStreamUrl()');
    const streamUrl = yield agqr.getStreamUrl();
    console.log(streamUrl);

    // 特番判定
    console.log('isScheduledProgram()');
    if (programs.now && streamProgram) {
        const isScheduled =
            agqr.isScheduledProgram(programs.now.title, streamProgram.title);
        console.log(isScheduled);
    } else {
        console.log(programs.now);
        console.log(streamProgram);
    }

    /*
        /lib/program.js
    */
    const Program = require('../lib/program');
    const sleep = require('sleep-promise');

    // インスタンス生成
    console.log('new Program()');
    const tempProgram = new Program();
    console.log(tempProgram);

    // 録画開始
    console.log('startRecording()');
    yield tempProgram.startRecording(streamUrl);
    console.log(tempProgram);

    // 30秒待機
    yield sleep(30 * 1000);

    // 録画停止
    console.log('stopRecording()');
    yield tempProgram.stopRecording();
    console.log(tempProgram);

    // エンコード
    console.log('encodeRecordedFile()');
    yield tempProgram.encodeRecordedFile();
    console.log(tempProgram);

    // flvファイル削除
    console.log('deleteRecordedFile()');
    yield tempProgram.deleteRecordedFile();
    console.log(tempProgram);

}).catch((error) => {
    console.log(error);
    process.exit(1);
});

/*eslint-enable */
