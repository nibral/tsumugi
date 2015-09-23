var url = 'http://www.agqr.jp/timetable/streaming.php';

var request = require('request');
var parseString = require('xml2js').parseString;

// 日付のフォーマット
var formatDate = function (date, format) {
    if (!format) {
        format = 'YYYY-MM-DD_hh:mm:ss';
    }

    format = format.replace(/YYYY/g, date.getFullYear());
    format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
    format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
    format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
    format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
    format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));

    return format;
};

// 録画
exports.record = function (programInfo, onComplete) {
    var startat = new Date(programInfo['startat']);
    var datetime = formatDate(startat, 'YYYYMMDD_hhmmss');

    // stub
    programInfo['video'] = datetime + '_video.mp4';
    programInfo['audio'] = datetime + '_audio.mp4';

    onComplete(programInfo);
}