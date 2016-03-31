'use strict';

/*
    超!A&Gの番組表と配信情報
*/

const request = require('request-promise');
const Program = require('./program');

/*
    番組表の形式

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
let timetable;

// tdタグを解析してProgramのインスタンスを返す
const parseCellInTimetableHTML = ($, tdElement, rowskip, dayNo) => {
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

// tableタグの内容を番組表に登録
const parseTimetableHTML = ($) => {
    // 番組表初期化
    timetable = {};
    for (let i = 1; i <= 7; i++) {
        timetable[i] = [];
    }

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
            const program =
                parseCellInTimetableHTML($, element, rowskip, dayNo);
            const programInfo = program.info;
            if (programInfo.time && programInfo.title
                && !(programInfo.title.match(/放送休止/))) {
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
*/
module.exports.downloadAndParseTimetable = () => {
    return new Promise((resolve, reject) => {
        const cheerio = require('cheerio');
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
            // HTML解析
            parseTimetableHTML($);

            resolve(timetable);
        }).catch((error) => {
            reject(error);
        });
    });
};

// 番組表と同じ形式(先頭0埋め2桁)の時刻表記を得る
const getTimeString = (time) => {
    const temp = new Date(time);
    const hour = ('0' + temp.getHours()).slice(-2);
    const minute = ('0' + temp.getMinutes()).slice(-2);
    return hour + ':' + minute;
};

// 番組表から指定した時刻に放送中の番組を探す
const searchProgramFromTimetable = (time) => {
    // 番組の区切りを00分/30分と仮定し、直近の区切りから検索開始
    const start = new Date(time.getTime());
    start.setMinutes((start.getMinutes() < 30) ? 0 : 30);

    let nowProgram = null;
    while (!nowProgram) {
        // 曜日と開始時刻が一致する番組を検索
        const startStr = getTimeString(start);
        const startDayNo = (start.getDay() === 0) ? 7 : time.getDay();
        for (let i = 0; i < timetable[startDayNo].length; i++) {
            if (timetable[startDayNo][i].info.time === startStr) {
                nowProgram = timetable[startDayNo][i].info;
                break;
            }
        }

        // 見つからなければ検索時刻を30分前に移動
        if (!nowProgram) {
            start.setTime(start.getTime() - 30 * 60 * 1000);
        }
    }

    // 番組の開始時刻と終了時刻を記録
    nowProgram.start = start.getTime();
    nowProgram.end = start.getTime() + nowProgram.length * 60 * 1000;

    return nowProgram;
};

// offset分後に放送中の番組を探す
const searchProgramAfter = (time, offset, nowProgram) => {
    const next = new Date(time.getTime() + offset * 60 * 1000);
    next.setMinutes((next.getMinutes() < 30) ? 0 : 30);
    const nextStr = getTimeString(next);
    const nextDayNo = (next.getDay() === 0) ? 7 : next.getDay();

    let nextProgram = null;
    if (next.getTime() < nowProgram.end) {
        // 同じ番組が継続中
        nextProgram = new Program(nowProgram);
    } else {
        // 次の番組に移行した
        for (let i = 0; i < timetable[nextDayNo].length; i++) {
            if (timetable[nextDayNo][i].info.time === nextStr) {
                nextProgram = timetable[nextDayNo][i].info;
                break;
            }
        }
    }

    // 番組の開始時刻と終了時刻を記録
    if (nextProgram) {
        nextProgram.start = next.getTime();
        nextProgram.end = next.getTime() + nextProgram.length * 60 * 1000;
    }

    return nextProgram;
};

/*
    番組表から今放送中及び30分後に放送中の番組情報を取得
*/
module.exports.getProgramInfoFromTimetable = () => {
    // 放送中の番組を検索
    const now = new Date();
    const nowProgram = searchProgramFromTimetable(now);

    // 現時刻が放送終了時刻よりも後なら、放送は終わっている
    if (now.getTime() > nowProgram.end) {
        return {
            now: null,
            next: null
        };
    }

    // 30分後に放送中の番組を検索
    const nextProgram = searchProgramAfter(now, 30, nowProgram);

    return {
        now: nowProgram,
        next: nextProgram
    };
};


/*
    動画の配信URLを取得
*/
module.exports.getStreamUrl = () => {
    return new Promise((resolve, reject) => {
        const streamListUrl =
            'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';
        request(streamListUrl).then((response) => {
            // XML解析
            const parseString = require('xml2js').parseString;
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
    配信画面をもとに、現在放送されている番組の情報を返す

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

// str1とstr2のレーベンシュタイン距離(編集距離)を求める
const calculateLevenshteinDistance = (str1, str2) => {
    // 距離テーブル初期化
    let distanceTable = new Array(str1.length + 1);
    for (let row = 0; row < str1.length + 1; row++) {
        distanceTable[row] = new Array(str2.length + 1);
    }

    // 空文字列との距離を格納(1行目と1列目)
    for (let row = 0; row < str1.length + 1; row++) {
        distanceTable[row][0] = row;
    }
    for (let col = 0; col < str2.length + 1; col++) {
        distanceTable[0][col] = col;
    }

    // 最小の距離でテーブルを埋める
    for (let row = 1; row < str1.length + 1; row++) {
        for (let col = 1; col < str2.length + 1; col++) {
            const char1 = str1.charAt(row - 1);
            const char2 = str2.charAt(col - 1);
            const replaceCost = (char1 === char2) ? 0 : 1;
            distanceTable[row][col] = Math.min(
                distanceTable[row - 1][col] + 1,                // 挿入
                distanceTable[row][col - 1] + 1,                // 削除
                distanceTable[row - 1][col - 1] + replaceCost   // 置換
            );
        }
    }

    return distanceTable[str1.length][str2.length];
};

/*
    番組名を元に、放送中の番組が番組表上のものと一致しているかを返す

    番組表上の番組名(title)と配信画面の番組名(streamTitle)を比較し、
    以下の条件a,bのいずれかを満たす場合に番組が一致している(=特番でない)と判定する
*/
module.exports.isScheduledProgram = (title, streamTitle) => {
    // 番組名をUnicode正規化(互換等価モード)
    //   String.prototype.includes()で大文字小文字の区別を行うか否かの指定ができないので、
    //   小文字で統一
    const normalizedTitle = title.normalize('NFKC').toLowerCase();
    const normalizedStreamTitle =
        streamTitle.normalize('NFKC').toLowerCase().replace('<br>', '');

    // 条件a: titleをスペースで分割し、すべての要素がstreamTitleに含まれる
    //       => 番組表に正確な番組名が掲載されていない
    //          (アクターズゲート,らじおどっとあい,A&G ARTIST ZONE THE CATCH)
    let isAllElementMatched = true;
    normalizedTitle.split(' ').forEach((element) => {
        isAllElementMatched &= normalizedStreamTitle.includes(element);
    });
    if (isAllElementMatched) {
        return true;
    }

    // 条件b: titleとstreamTitleのレーベンシュタイン距離がしきい値以下である
    const LEVENSTEIN_THRESHOLD = 10;
    const distanceOfTitle =
        calculateLevenshteinDistance(normalizedTitle, normalizedStreamTitle);
    if (distanceOfTitle <= LEVENSTEIN_THRESHOLD) {
        return true;
    }

    return false;
};
