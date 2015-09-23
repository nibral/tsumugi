var streamListUrl = 'http://www.uniqueradio.jp/agplayerf/getfmsListHD.php';

var config = require('../config.json');
var child_process = require('child_process');
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
    var startAt = new Date(programInfo['startAt']);
    var datetime = formatDate(startAt, 'YYYYMMDD_hhmmss');
    
    // 配信URL取得
    request(streamListUrl, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            // XML解析
            parseString(body, function (err, result) {
                if (err) {
                    console.log(err);
                }

                var serverinfo = result.ag.serverlist[0].serverinfo[0];
                var server = serverinfo.server[0].match(/^.*(rtmp.*)$/)[1];
                var app = serverinfo.app[0];
                var stream = serverinfo.stream[0];
                var streamUrl = server + '/' + app + '/' + stream;

                // 録画
                var videoFilename = config.outputDir + datetime + '_video.mp4';
                var audioFilename = config.outputDir + datetime + '_audio.mp4';
                var ffmpeg = child_process.spawn(config.ffmpeg, [
                    '-y',
                    '-re',
                    '-t', programInfo['length'] * 60,
                    '-i', streamUrl,
                // video
                    '-vcodec', 'copy',
                    '-acodec', 'libfdk_aac',
                    '-ac', '1',
                    '-ab', '32k',
                    '-ar', '24000',
                    videoFilename,
                // audio
                    '-vn',
                    '-acodec', 'libfdk_aac',
                    '-ac', '1',
                    '-ab', '32k',
                    '-ar', '24000',
                    audioFilename
                ]);
                ffmpeg.on('close', function () {
                    var thumbnailFilename = config.outputDir + datetime + '_thumbnail.jpg';
                    var ffmpeg2 = child_process.spawn(config.ffmpeg, [
                    // thumbnail
                        '-ss', '20',
                        '-i', videoFilename,
                        '-vframes', '1',
                        '-f', 'image2',
                        '-s', '320x180',
                        thumbnailFilename
                    ]);
                    ffmpeg2.on('close', function () {
                        // 後処理呼び出し
                        programInfo['video'] = videoFilename;
                        programInfo['audio'] = audioFilename;
                        programInfo['thumbnail'] = thumbnailFilename;
                        onComplete(programInfo);
                    });
                });
            });
        } else {
            console.error('Failed to get stream url: ' + res.statusCode);
        }
    });
}