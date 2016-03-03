'use strict';

const child_process = require('child_process');
const fs = require('fs');
const agqr = require('./agqr');

class Recorder {
    /*
        rtmpdumpを使ってストリームの録画処理を行う
    */
    constructor(streamUrl, options) {
        // 録画するストリームの指定は必須
        if (!streamUrl) {
            throw Error('Recording source URL must be specified.');
            return;
        }

        this.setStreamUrl(streamUrl);
        this.setOptions(options);
    }

    /*
        アクセサ関数群
    */
    get getStreamUrl() {
        return this.streamUrl;
    }
    set setStreamUrl(url) {
        this.streamUrl = url;
    }
    get getOptions() {
        return this.options;
    }
    set setOptions(options) {
        this.options = options;
    }

    /*
        録画開始
    */
    start() {
        throw Error('Recorder.start() is not implemented.');
        // TODO
        /*
            this.filename = Date.now() + '.flv';
            this.rtmpdump = child_process.spawn('rtmpdump', [
                '--rtmp', 'rtmp://fms-base1.mitene.ad.jp/agqr/aandg22',
                '--live',
                '--flv', this.filename
            ]);
            console.log('rec start ' + this.filename);
        */
    }

    /*
        録画停止    
    */
    stop() {
        throw Error('Recorder.stop() is not implemented.');
        // TODO
        /*
            if (this.rtmpdump) {
                if (isUnlink) {
                    var unlinkFile = this.filename;
                    this.rtmpdump.on('close', function () {
                        fs.unlinkSync(unlinkFile);
                        console.log('unlinked ' + unlinkFile);
                    });
                }
                this.rtmpdump.kill('SIGINT');
                console.log('rec stop ' + this.filename);
            }
        */
    }
}

module.exports = Recorder;
