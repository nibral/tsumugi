var agqrStreamUrl = 'rtmp://fms-base1.mitene.ad.jp/agqr/aandg11';

var fs = require('fs');
var exec = require('child_process').exec;
var config = require('config');
var rtmpdump = config.rtmpdump;
var ffmpeg = config.ffmpeg;
var outputDir = config.outputDir;

var encode = function(filename) {
    var flvPath = '"' + outputDir + '/' + filename + '.flv"';
    var mp4Path = '"' + outputDir + '/' + filename + '.mp4"';
    var encodeCommand = ffmpeg + ' -y -i ' + flvPath + ' -vcodec copy -acodec libfdk_aac -ac 1 -ab 32k -ar 24000 -async 1 -afterburner 1 ' + mp4Path;
    exec(encodeCommand, {maxBuffer: 1*1024*1024}, function(err, stdout, stderr) {
        if(err) throw err;
        console.log('finish encode:' + mp4Path);

        flvPath = flvPath.slice(1, -1);
        fs.unlink(flvPath, function(err){
            if(err) throw err;
            console.log('unlink:' + flvPath);
        });

        var thumbnailPath = '"' + outputDir + '/' + filename + '.jpg"';
        var thumbnailCommand = ffmpeg + ' -y -i ' + mp4Path + ' -ss 20 -vframes 1 -f image2 -s 320x240 ' + thumbnailPath;
        exec(thumbnailCommand, {maxBuffer: 1*1024*1024}, function(err, stdout, stderr) {
            if(err) throw err;
            console.log('generate thumbnail:' + thumbnailPath);
        });
    });
    console.log('start encode:' + mp4Path);
}

exports.record = function(filename, length) {
    var flvPath = '"' + outputDir + '/' + filename + '.flv"';
    var lengthSec = length * 60 + 15;
    var recordCommand = rtmpdump + ' -r ' + agqrStreamUrl + ' --live -B ' + lengthSec + ' -o ' + flvPath;
    exec(recordCommand, {maxBuffer: 1*1024*1024}, function(err, stdout, stderr) {
        if(err) throw err;
        console.log('finish recode:' + flvPath);
        encode(filename);
    });
    console.log('start recode:' + flvPath);
};


