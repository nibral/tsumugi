var child_process = require('child_process');
var fs = require('fs');
var path = require('path');

// デバック用ログ出力
var print = function (who, where, what) {
    if (process.env.NODE_ENV !== 'production') {
        console.log(who + ':' + where + ':' + what);
    }
}

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

// エンコード
var encode = function (flvFilePath, callback) {
    var dir = path.dirname(flvFilePath);
    var base = path.basename(flvFilePath, '.flv');
    var videoFilePath = dir + path.sep + base + '_video.mp4';
    var audioFilePath = dir + path.sep + base + '_audio.mp4';
    var thumbnailFilePath = dir + path.sep + base + '_thumbnail.jpg';

    print('encode', 'file', videoFilePath);
    var ffmpeg = child_process.spawn('ffmpeg', [
        '-y',
        '-i', flvFilePath,
    // video
        '-vcodec', 'copy',
        '-acodec', 'libfdk_aac',
        '-ac', '1',
        '-ab', '32k',
        '-ar', '24000',
        videoFilePath,
    // audio
        '-vn',
        '-acodec', 'libfdk_aac',
        '-ac', '1',
        '-ab', '32k',
        '-ar', '24000',
        audioFilePath,
    //thumbnail
        '-ss', '20',
        '-vframes', '1',
        '-f', 'image2',
        '-s', '320x180',
        thumbnailFilePath
    ]);
    ffmpeg.stdout.on('data', function (data) {
        print('ffmpeg', 'stdout', data);
    });
    ffmpeg.stderr.on('data', function (data) {
        print('ffmpeg', 'stderr', data);
    });
    ffmpeg.on('close', function () {
        // flvを削除してコールバック呼び出し
        fs.unlink(flvFilePath, function (error) {
            if (error) { throw error; }
        });
        callback({
            'video': videoFilePath,
            'audio': audioFilePath,
            'thumbnail': thumbnailFilePath
        });
    });
}

// 録画
exports.record = function (streamUrl, length, startAt, callback) {
    var datetime = formatDate(startAt, 'YYYYMMDD_hhmmss');
    var flvFilePath = path.resolve(datetime + 'flv');
    
    // rtmpdump呼び出し
    print('recode', 'file', flvFilePath);
    var rtmpdump = child_process.spawn('rtmpdump', [
        '--rtmp', streamUrl,
        '--live',
        '--stop', length,
        '--flv', flvFilePath
    ]);
    rtmpdump.stdout.on('data', function (data) {
        print('rtmpdump', 'stdout', data);
    });
    rtmpdump.stderr.on('data', function (data) {
        print('rtmpdump', 'stderr', data);
    });
    rtmpdump.on('close', function () {
        // エンコード
        encode(flvFilePath, callback);
    });
}
    