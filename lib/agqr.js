'use strict';

const request = require('request-promise');
const cheerio = require('cheerio');
const parseString = require('xml2js').parseString;
const Program = require('./program');

/*
    tdタグを解析してProgramのインスタンスを返す
*/
const parseEachCellInTimetable = ($, tdElement, rowskip, dayNo) => {
    // 時間(hh:mm形式)
    let time = $(tdElement).children('.time').text();
    time = time.replace(/\n/g, '').trim();
    time = ('0' + time).slice(-5);

    // 番組名
    let title = $(tdElement).children('.title-p').text();
    title = title.replace(/\n/g, '').trim();

    // パーソナリティ(情報がない場合は空文字列)
    let personality = $(tdElement).children('.rp').text();
    personality = personality.replace(/\n/g, '').trim();
    if (!personality) {
        personality = '';
    }

    // 番組の枠数(30分単位)
    // rowspanが未定義(=30分番組)なら1
    let rowspan = $(tdElement).attr('rowspan');
    rowskip[dayNo] = rowspan = rowspan ? rowspan : 1;

    // 番組種別
    let programType = '';
    switch ($(tdElement).attr('class')) {
        case 'bg-l':
            programType = 'Live';
            break;
        case 'bg-f':
            programType = 'First';
            break;
        default:
            programType = 'Repeat';
            break;
    }

    return new Program({
        time: time,
        title: title,
        personality: personality,
        length: rowspan * 30,
        type: programType
    });
};

/*
    tableタグの内容を番組表に登録
*/
const parseTimetableHTML = ($, timetable) => {
    // 前枠継続フラグ
    let rowskip = [0, 0, 0, 0, 0, 0, 0];

    // 1行が30分刻みの放送枠を表す
    $('.timetb-ag > tbody > tr').each((rowIndex, row) => {
        // 曜日ごとに番組情報解析
        let dayNo = 0;
        $(row).children('td').each((colIndex, element) => {
            /*
                2つ以上の放送枠を使う番組がある場合、(colIndex + 1)が
                曜日番号と一致しなくなるのでdayNoとして別に定義している
            */
            // 前枠が継続する曜日をスキップ
            while (rowskip[dayNo] > 0) {
                dayNo++;
            }

            // tdタグを解析して、時間と番組名が揃っていれば番組として登録
            const program = parseEachCellInTimetable($, element, rowskip, dayNo);
            const programInfo = program.info;
            if (programInfo.time && programInfo.title && !(programInfo.title.match(/放送休止/))) {
                // 0:00～5:00は次の曜日
                let hour = parseInt((programInfo.time.split(':'))[0]);
                let startDayNo = ((hour <= 5) ? dayNo + 1 : dayNo) % 7;

                timetable[startDayNo + 1].push(program);
            }

            // 曜日番号を進める
            dayNo++;
        });

        // 前枠継続フラグを1減らして次の枠へ
        for (let i = 0; i < rowskip.length; i++) {
            rowskip[i]--;
        }
    });

    // 開始時刻でソート
    for (const dayNo in timetable) {
        timetable[dayNo].sort((a, b) => {
            if (a.info.time > b.info.time) {
                return 1;
            }
            if (a.info.time < b.info.time) {
                return -1;
            }
            return 0;
        });
    }
};

/*
    超!A&G公式HPを解析して番組表(timetable)を取得

    曜日番号は月曜が1、日曜が7(ISO 8601準拠)
    timetable: {
        "1": [ Program, Program, ... ],
        "2": ...
        ...
    }

    Program.info{
        "time": 開始時刻("16:00")
        "title": 番組名,
        "personaliy": パーソナリティ,
        "length": 番組長(分),
        "type": 番組種別(Live|First|Repeat)
    }
*/
module.exports.downloadAndParseTimetable = () => {
    return new Promise((resolve, reject) => {
        const timetableUrl = 'http://www.agqr.jp/timetable/streaming.html';
        const options = {
            url: timetableUrl,
            transform: (body) => {
                // 番組表のHTMLが一部壊れているので修正する
                // tr開始タグが余計
                body = body.replace(/<\/tr>[\s]*<tr>[\s]*<tr>/g, '</tr>\n<tr>');
                // tr開始タグが足りない
                body = body.replace(/<\/tr>[\s]*<th/g, '</tr>\n<tr>\n<th');

                return cheerio.load(body);
            }
        };

        request(options).then(($) => {
            // 番組表初期化
            let timetable = {};
            for (let i = 1; i <= 7; i++) {
                timetable[i] = [];
            }
            // HTML解析
            parseTimetableHTML($, timetable);
            resolve(timetable);
        }).catch((error) => {
            reject(error);
        });
    });
};

/*
    番組表から現在放送中の番組と次の番組の情報を取得
*/
module.exports.getProgramInfo = (timetable) => {
    return new Promise((resolve, reject) => {
        if (!timetable) {
            reject(Error('timetable undefined'));
        }

        // 番組表と同じ形式(先頭0埋め2桁)の時刻表記を得る
        const getTimeString = (time) => {
            const temp = new Date(time);
            const hour = ('0' + temp.getHours()).slice(-2);
            const minute = ('0' + temp.getMinutes()).slice(-2);
            return hour + ':' + minute;
        };

        // 曜日番号を0-6から1-7に合わせる
        const adaptDayNo = (dayNo) => {
            return (dayNo === 0) ? 7 : dayNo;
        };

        /*
            番組の区切りを00分/30分と仮定し、30分ずつ遡って放送中の番組情報を探す
        */

        // 直近の区切りから検索開始
        const now = new Date();
        const startTime = new Date(now.getTime());
        startTime.setMinutes((startTime.getMinutes() < 30) ? 0 : 30);

        let nowProgram = null;
        while (!nowProgram) {
            // 曜日と開始時刻が一致する番組を検索
            const startTimeStr = getTimeString(startTime);
            const startDayNo = adaptDayNo(startTime.getDay());
            for (let i = 0; i < timetable[startDayNo].length; i++) {
                if (timetable[startDayNo][i].info.time === startTimeStr) {
                    nowProgram = timetable[startDayNo][i].info;
                    break;
                }
            }

            // 見つからなければ検索時刻を30分前に移動
            if (!nowProgram) {
                startTime.setTime(startTime.getTime() - 30 * 60 * 1000);
            }
        }

        // 現時刻と開始時刻の差が番組長を越えている場合、
        // 既に番組は終わって放送休止になっているのでreject
        const diff = (now.getTime() - startTime.getTime()) / 60 / 1000;
        if (diff > nowProgram.length) {
            reject(Error('Broadcast is currently paused.'));
            return;
        }

        // 放送中番組の開始時刻に番組長を足して、次の番組を検索
        const nextStartTime = new Date(startTime.getTime() + nowProgram.length * 60 * 1000);
        const nextStartTimeStr = getTimeString(nextStartTime);
        const nextStartDayNo = adaptDayNo(nextStartTime.getDay());
        let nextProgram = null;
        for (let i = 0; i < timetable[nextStartDayNo].length; i++) {
            if (timetable[nextStartDayNo][i].info.time === nextStartTimeStr) {
                nextProgram = timetable[nextStartDayNo][i].info;
                break;
            }
        }

        resolve({
            now: nowProgram,
            next: nextProgram
        });
    });
};

/*
    動画の配信URLを取得
*/
module.exports.getStreamUrl = () => {
    return new Promise((resolve, reject) => {
        const streamListUrl = 'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';
        request(streamListUrl).then((response) => {
            // XML解析
            parseString(response, function(parseError, parseResult) {
                if (parseError) {
                    reject(parseError);
                }

                // URLリストの先頭要素を返す
                const serverinfo = parseResult.ag.serverlist[0].serverinfo[0];
                const server = serverinfo.server[0].match(/^.*(rtmp.*)$/)[1];
                const app = serverinfo.app[0];
                const stream = serverinfo.stream[0];
                const streamUrl = server + '/' + app + '/' + stream;
                resolve(streamUrl);
            });
        }).catch((error) => {
            reject(error);
        });
    });
};

/*
    配信画面をもとに、現在配信されている番組の情報を返す
    (番組表の情報とは異なる可能性がある)

    番組情報: {
        "title": 番組名,
        "personaliy": パーソナリティ
    }
*/
module.exports.getStreamingProgramInfo = () => {
    return new Promise((resolve, reject) => {
        const streamInfoUrl = 'http://www.uniqueradio.jp/aandg';

        // 配信画面用のJavaScriptコードが得られるが、
        // evalによる実行はせずに文字列として解析する
        request(streamInfoUrl).then((response) => {
            // 改行コードで分割して、番組名とパーソナリティを定義している行を探す
            let title = '';
            let personality = '';
            response.split(/\n/g).forEach((line) => {
                const definition = line.split(' = ');
                if (definition[0].match(/Program_name/)) {
                    title = definition[1].slice(1, -2);
                }
                if (definition[0].match(/Program_personality/)) {
                    personality = definition[1].slice(1, -2);
                }
            });

            // 文字列がURIエンコードされているので、デコードして返す
            resolve({
                title: decodeURIComponent(title),
                personality: decodeURIComponent(personality)
            });
        }).catch((error) => {
            reject(error);
        });
    });
};
