var url = 'http://www.agqr.jp/timetable/streaming.php';

var request = require('request');
var parseString = require('xml2js').parseString;

// 録画
exports.record = function (programInfo) {
    // stub
    console.log('record:');
    console.log(programInfo);
}