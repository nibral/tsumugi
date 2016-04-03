'use strict';

/*
    超!A&G録画スケジューラ
*/

const co = require('co');
const path = require('path');
const sleep = require('sleep-promise');
let setting = {};

// 連想配列aにbを連結する
const extend = (target, arg) => {
    Object.keys(arg).forEach((key) => {
        target[key] = arg[key];
    });

    return target;
};

// 録画設定のキーワードが、番組名またはパーソナリティに含まれるか判定する
const isProgramInfoContainsKeyword = (info) => {
    let isTitleHit = false;
    let isPersonalityHit = false;
    setting.keyword.forEach((keyword) => {
        isTitleHit |= info.title.includes(keyword);
        isPersonalityHit |= info.personality.includes(keyword);
    });

    return (isTitleHit || isPersonalityHit) ? true : false;
};

// 録画の後処理
const stopRecord = (program, isSave) => {
    return new Promise((resolve, reject) => {
        co(function* () {
            yield program.stopRecording();

            // 番組表通りの時のみリピート放送判定
            let isLiveOrFirst = true;
            if (program.info.isScheduled) {
                const programType = program.info.type;
                isLiveOrFirst =
                    (programType === 'Live' || programType === 'First');
            }
            console.log('isRepeat:' + isLiveOrFirst);

            // キーワード判定
            const isKeywordHit = isProgramInfoContainsKeyword(program.info);
            console.log('isKeywordHit:' + isKeywordHit);

            // 条件をすべて満たしたらエンコード
            if (isSave && isLiveOrFirst && isKeywordHit) {
                // yield program.encodeRecordedFile();
                console.log('--encode condition fulfilled--');
            }

            // flvファイル削除
            yield program.deleteRecordedFile();
            console.log('-- delete recorded --');

            resolve();
        }).catch((error) => {
            reject(error);
        });
    });
};

// 録画処理
let recProgram;
const record = () => {
    co(function* () {
        const agqr = require('./agqr');
        const Program = require('./program');

        console.log('--start--');
        const now = new Date();
        console.log(now.toString());

        // 配信URLを取得し録画開始
        const streamUrl = yield agqr.getStreamUrl();
        const newProgram = new Program();
        newProgram.startRecording(streamUrl);
        console.log('--recstart--');

        // 次の枠になるまで待つ
        yield sleep(30 * 1000);

        // 番組表と配信画面から番組情報を取得
        yield agqr.downloadAndParseTimetable();
        const info = agqr.getProgramInfoFromTimetable();
        const streamInfo = yield agqr.getStreamingProgramInfo();
        console.log(info);
        console.log(streamInfo);

        // 放送休止に入ったら新しく始めた録画のデータは不要
        // 先行する録画を止めて終了
        if (!streamInfo) {
            console.log('--broadcast suspended--');
            yield stopRecord(newProgram, false);
            if (recProgram) {
                yield stopRecord(recProgram, true);
                recProgram = null;
            }
            return;
        }

        // 特番判定
        const isScheduled =
            agqr.isScheduledProgram(info.title, streamInfo.title);

        //番組情報保存
        newProgram.info =
            extend(newProgram.info, isScheduled ? info : streamInfo);
        newProgram.info.isScheduled = isScheduled;
        console.log('newProgram--');
        console.log(newProgram.info);

        // 先行する録画がない場合はそのまま録画継続
        if (!recProgram) {
            recProgram = newProgram;
            console.log('--recording is null, continue--');
            return;
        }

        // 番組名・特番判定が変化していたら先行する録画を止める
        const isTitleChanged = newProgram.info.title !== recProgram.info.title;
        const isStatusChanged =
            newProgram.info.isScheduled !== recProgram.info.isScheduled;
        console.log('isTitleChanged:' + isTitleChanged);
        console.log('isStatusChanged:' + isStatusChanged);
        if (isTitleChanged || isStatusChanged) {
            console.log('--program changed--');
            yield stopRecord(recProgram, true);
            recProgram = newProgram;
        } else {
            console.log('--program not changed--');
            yield stopRecord(newProgram, false);
        }

    }).then(() => {
        console.log('recProgram--');
        console.log(recProgram);
        console.log('--end--');
    }).catch((error) => {
        console.log(error);
    });
};

// 録画設定の更新
const CONFIG_FILE_NAME = path.resolve(__dirname, '../config.json');
const updateConfigFromFile = () => {
    // requireはキャッシュされるので、削除してから再登録
    if (require.cache[CONFIG_FILE_NAME]) {
        delete require.cache[CONFIG_FILE_NAME];
    }
    setting = require(CONFIG_FILE_NAME);
};

/*
    スケジューリング開始
*/
let configFileWatcher;
let recordJob;
module.exports.start = () => {
    // 録画設定ファイルの監視
    const fs = require('fs');
    updateConfigFromFile();
    configFileWatcher = fs.watch(CONFIG_FILE_NAME, (event) => {
        if (event === 'change') {
            updateConfigFromFile();

            const now = new Date();
            console.log(now.toString());
            console.log('config changed');
        }
    });

    // 録画ジョブ登録(停止時処理なし,即時開始,タイムゾーン東京)
    const CronJob = require('cron').CronJob;
    recordJob =
        new CronJob('45 29,59 * * * *', record, null, true, 'Asia/Tokyo');
};

/*
    スケジューリング停止
*/
module.exports.stop = () => {
    if (configFileWatcher) {
        configFileWatcher.close();
        configFileWatcher = null;
    }
    if (recordJob) {
        recordJob.stop();
        recordJob = null;
    }
    if (recProgram) {
        recProgram.stopRecording();
        recProgram = null;
    }
};
