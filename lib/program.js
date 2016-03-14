'use strict';

const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

/*
    超!A&Gの番組

    外部から参照・変更しても安全なプロパティはinfoのみ
*/
class Program {

    /*
        インスタンス生成時に番組情報(番組名,パーソナリティ,etc.)を記録できる
    */
    constructor(programInfo) {
        this.info = (programInfo) ? programInfo : {};
    }

    /*
        録画開始
    */
    startRecording(streamUrl) {
        return new Promise((resolve, reject) => {
            if (!streamUrl) {
                reject(Error('Recording source URL must be specified.'));
                return;
            }

            // 現時刻から録画ファイルへの絶対パスを生成
            const filenameFromTime = path.join(path.resolve(''), new Date().getTime() + '.flv');

            // rtmpdump起動
            this.rtmpdump = child_process.spawn('rtmpdump', [
                '--rtmp', streamUrl,
                '--live',
                '--flv', filenameFromTime
            ]);
            this.info.recorded = filenameFromTime;
            resolve();
        });
    }

    /*
        録画終了
    */
    stopRecording() {
        return new Promise((resolve, reject) => {
            // 録画中でないときはreject
            if (!this.rtmpdump) {
                reject(Error('Process of rtmpdump is not found.'));
                return;
            }

            // rtmpdumpにCtrl+Cのシグナルを送って終了を待つ
            this.rtmpdump.on('close', () => {
                this.rtmpdump = null;
                resolve();
            });
            this.rtmpdump.kill('SIGINT');
        });
    }

    /*
        録画ファイル(flv)の削除
    */
    deleteRecordedFile() {
        return new Promise((resolve, reject) => {
            // 録画中はファイルを削除できない
            if (this.rtmpdump) {
                reject('This program is still recording.');
                return;
            }

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
        });
    }

    /*
        録画ファイルをストリーミングできる形式にエンコード
            動画付き: H264(元ファイルからコピー) + aac(1ch,32kbps,24KHz)
            音声のみ: aac(1ch,32kbps,24KHz)
            サムネイル: jpg(先頭から20秒後,320x180,jpg)
    */
    encodeRecordedFile() {
        return new Promise((resolve, reject) => {
            if (!this.info.recorded) {
                reject(Error('Recorded file is not found.'));
                return;
            }

            // エンコード後のファイル名生成
            const flvFilename = this.info.recorded;
            const dir = path.dirname(flvFilename);
            const basename = path.basename(flvFilename, '.flv');
            const videoFilePath = dir + path.sep + basename + '.mp4';
            const audioFilePath = dir + path.sep + basename + '.m4a';
            const thumbnailFilePath = dir + path.sep + basename + '.jpg';

            // ffmpeg起動
            const ffmpeg = child_process.spawn('ffmpeg', [
                '-y',
                '-i', flvFilename,
            // video
                '-vcodec', 'copy',
                '-acodec', 'aac',
                '-ac', '1',
                '-ab', '32k',
                '-ar', '24000',
                videoFilePath,
            // audio
                '-vn',
                '-acodec', 'aac',
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

            ffmpeg.on('error', (error) => {
                reject(error);
            });

            // エンコードが終わったらファイル名を記録して終了
            ffmpeg.on('close', () => {
                this.info.video = videoFilePath;
                this.info.audio = audioFilePath;
                this.info.thumbnail = thumbnailFilePath;
                resolve();
            });
        });
    }
}

module.exports = Program;
