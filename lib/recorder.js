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
            // rtmpdumpのプロセス終了
            if (this.rtmpdump) {
                this.rtmpdump.on('close', () => {
                    if (isUnlink) {
                        // ファイル削除はプロセス終了後に行う(終了前に削除しようとするとEBUSYで落ちる)
                        const unlinkFilename = this.options.filename;
                        fs.unlink(unlinkFilename, (err) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            // optionsからflvファイルの名前を削除してresolve
                            delete this.options.filename;
                            resolve(this.options);
                        });

                    } else {
                        // ファイルを残す場合はそのままoptionsを返す
                        resolve(this.options);
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
    encode(flvFilePath) {
        return new Promise((resolve, reject) => {
            const dir = path.dirname(flvFilePath);
            const basename = path.basename(flvFilePath, '.flv');
            const videoFilePath = dir + path.sep + basename + '_video.mp4';
            const audioFilePath = dir + path.sep + basename + '_audio.m4a';
            const thumbnailFilePath = dir + path.sep + basename + '_thumbnail.jpg';

            // ffmpeg起動
            const ffmpeg = child_process.spawn('ffmpeg', [
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

            // エラー時はreject
            ffmpeg.on('error', (error) => {
                reject(error);
            });

            // 正常終了したら
            ffmpeg.on('close', () => {
                // flvを削除
                fs.unlink(flvFilePath, (error) => {
                    if (error) {
                        reject(error);
                    }
                });
                // エンコード後のファイル名を返す
                resolve({
                    'video': videoFilePath,
                    'audio': audioFilePath,
                    'thumbnail': thumbnailFilePath
                });
            });
        });
    }
}

module.exports = Recorder;
