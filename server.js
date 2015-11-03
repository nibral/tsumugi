var fs = require('fs');
var path = require('path');

// 超！A&G用スケジューラ
var scheduler = require('./bin/schedule');

scheduler.start(function (programInfo) {
    // 番組名のディレクトリをつくる
    var outputDir = path.join(path.resolve(''), 'public', 'streams',
        (programInfo.title).replace(/\|&;\$%@"<>\(\)\+,/g, ""));
    try {
        fs.mkdirSync(outputDir);
    } catch (error) {
        if (error.code != 'EEXIST') {
            throw (error);
        }
    }
    
    // ファイルを移動
    var video = path.basename(programInfo.video);
    var audio = path.basename(programInfo.audio);
    var thumbnail = path.basename(programInfo.thumbnail);
    fs.renameSync(programInfo.video, outputDir + path.sep + video);
    fs.renameSync(programInfo.audio, outputDir + path.sep + audio);
    fs.renameSync(programInfo.thumbnail, outputDir + path.sep + thumbnail);
});

// Webインターフェース
var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.send(JSON.stringify(scheduler.getTimetable(), null, '    '));
});

app.get('/refresh', function (req, res) {
    scheduler.refreshTimetable(function () {
        res.send('refresh ok');
    });
});

var server = app.listen(3000, function () {
    var host = server.address().address;
    var port = server.address().port;

    console.log('Example app listening at http://%s:%s', host, port);
});
