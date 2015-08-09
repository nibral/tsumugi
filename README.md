mocha
===

超!A&Gを保存して好きなときに見られるようにする

Require
---

各ソフトのインストール先を`/config/config.json`に書く

 * rtmpdump

  [さくらのVPSを使って、rtmpdumpでradikoを録音する](http://serima.co/blog/?p=51)を参考に
  
```
  sudo yum install openssl-devel
  wget http://rtmpdump.mplayerhq.hu/download/rtmpdump-2.3.tgz
  tar xzf rtmpdump-2.3.tgz
  cd rtmpdump-2.3
  make SYS=posix
  sudo cp -p rtmpdump rtmpgw rtmpsrv rtmpsuck /usr/local/bin
```

 * ffmpeg

  [CentOS6.xにFFmpegをインストールする](http://blog.code-life.net/blog/2013/04/14/how-to-install-ffmpeg-on-centos6-x86-64/)

TODO
---

* Materializeでマシな見た目にする
  + サムネイルでカードUIにする
  + カード4枚ごとにrowタグで括るのをどうするか
  + テキストのみのページも出せるようにする？
* 録画スケジュールをWebから変更できるようにする
  + スケジュール情報の取り回しを変える必要あり
  + `schedule.json`の読み込みタイミングを`scheduler.start()`に移動？
