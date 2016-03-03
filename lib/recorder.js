'use strict';

const child_process = require('child_process');
const fs = require('fs');

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

        this.streamUrl = streamUrl;
        this.options = (options) ? options : {};
    }

    /*
        録画開始
    */
    start() {
        return new Promise((resolve, reject) => {
            const filename = new Date().getTime() + '.flv';
            this.options.filename = filename;
            this.rtmpdump = child_process.spawn('rtmpdump', [
                '--rtmp', this.streamUrl,
                '--live',
                '--flv', filename
            ]);
            resolve();
        });
    }

    /*
        録画停止
        
        isUnlinkにtrueを指定すると、録画したflvファイルを削除する
    */
    stop(isUnlink) {
        return new Promise((resolve, reject) => {
            if (this.rtmpdump) {
                // rtmpdumpのプロセスが終了したらresolve
                this.rtmpdump.on('close', () => {
                    if (isUnlink) {
                        // ファイル削除を行う場合はプロセス終了後に行う
                        // (終了前に削除しようとするとEBUSYで落ちる)
                        const unlinkFilename = this.options.filename;
                        fs.unlink(unlinkFilename, (err) => {
                            if (err) {
                                reject(err);
                            }
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });

                // rtmpdumpに中断シグナル(Ctrl+C)を送る
                this.rtmpdump.kill('SIGINT');
            } else {
                reject(Error('Process of rtmpdump is not found.'))
            }
        });
    }
}

module.exports = Recorder;
