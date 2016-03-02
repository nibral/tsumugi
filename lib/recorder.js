'use strict';

const child_process = require('child_process');
const fs = require('fs');

class Recorder {
    constructor(streamUrl, options) {
        // 録画するストリームの指定は必須
        if (!streamUrl) {
            throw Error('Recording source URL must be specified.');
            return;
        }

        this.streamUrl = streamUrl;
        this.options = options;
    }

    get title() {
        if (this.options.title) {
            return (this.options.title);
        } else {
            throw Error('options.title is not specified.');
        }
    }

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
