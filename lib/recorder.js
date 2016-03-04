'use strict';

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

class Recorder {
    /*
        rtmpdumpを使ってストリームの録画処理を行う
        
        optionsには番組名などの情報を入れることができる
    */
    constructor(streamUrl, options) {
        // 録画するストリームの指定は必須
        if (!streamUrl) {
            throw Error('Recording source URL must be specified.');
            return;
        }

        this.streamUrl = streamUrl;
        this.info = (options) ? options : {};
    }
    
    /*
        録画開始
    */
    start() {
        return new Promise((resolve, reject) => {
            const filenameFromTime = path.join(path.resolve(''), new Date().getTime() + '.flv');
            this.rtmpdump = child_process.spawn('rtmpdump', [
                '--rtmp', this.streamUrl,
                '--live',
                '--flv', filenameFromTime
            ]);
            this.info.recorded = filenameFromTime;
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
                // rtmpdumpのプロセス終了を待つ
                this.rtmpdump.on('close', () => {
                    if (!isUnlink) {
                        // 録画ファイルを残す
                        resolve();
                    } else {
                        // 録画ファイルを削除する
                        const unlinkFilename = this.info.recorded;
                        fs.unlink(unlinkFilename, (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            // optionsからflvファイルの名前を削除
                            delete this.info.recorded;
                            resolve();
                        });
                    }
                });

                // rtmpdumpに中断シグナル(Ctrl+C)を送る
                this.rtmpdump.kill('SIGINT');

            } else {
                // rtmpのプロセスが見つからない
                reject(Error('Process of rtmpdump is not found.'));
            }
        });
    }
    
    /*
        指定したファイルをストリーミングできる形式にエンコード
            動画付き: H264(元ファイルからコピー) + aac(1ch,32kbps,24KHz)
            音声のみ: aac(1ch,32kbps,24KHz)
            サムネイル: jpg(先頭から20秒後,320x180,jpg)
    */
    encode() {
        return new Promise((resolve, reject) => {
            if (!this.info.recorded) {
                reject(Error('Recorded file is not found.'));
                return;
            }

            // エンコード後のファイル名生成
            const flvFilename = this.info.recorded;
            const dir = path.dirname(flvFilename);
            const basename = path.basename(flvFilename, '.flv');
            const videoFilePath = dir + path.sep + basename + '_video.mp4';
            const audioFilePath = dir + path.sep + basename + '_audio.m4a';
            const thumbnailFilePath = dir + path.sep + basename + '_thumbnail.jpg';

            // ffmpeg起動
            const ffmpeg = child_process.spawn('ffmpeg', [
                '-y',
                '-i', flvFilename,
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

            // エラー時はreject
            ffmpeg.on('error', (error) => {
                reject(error);
            });

            // エンコードが終わったら、flvファイルを削除して終了
            ffmpeg.on('close', () => {
                fs.unlink(flvFilename, (error) => {
                    if (error) {
                        reject(error);
                    }
                    delete this.info.recorded;
                    this.info.video = videoFilePath;
                    this.info.audio = audioFilePath;
                    this.info.thumbnail = thumbnailFilePath;
                    resolve();
                });
            });
        });
    }
}

module.exports = Recorder;
