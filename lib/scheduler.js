'use strict';

/*
    超!A&G録画スケジューラ
*/

const path = require('path');
const CONFIG_FILE_NAME = path.resolve(__dirname, '../config.json');

// 録画設定の更新
const updateConfigFromFile = () => {
    // requireはキャッシュされるので、削除してから再登録
    if (require.cache[CONFIG_FILE_NAME]) {
        delete require.cache[CONFIG_FILE_NAME];
    }
    this.setting = require(CONFIG_FILE_NAME);
};

/*
    スケジューリング開始
*/
module.exports.start = () => {
    // 録画設定ファイルの監視
    const fs = require('fs');
    updateConfigFromFile();
    this.configFileWatcher = fs.watch(CONFIG_FILE_NAME, (event) => {
        if (event === 'change') {
            updateConfigFromFile();
        }
    });
};

/*
    スケジューリング停止
*/
module.exports.stop = () => {
    if (this.configFileWatcher) {
        this.configFileWatcher.close();
    }
};
