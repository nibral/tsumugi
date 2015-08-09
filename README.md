mocha
====

超!A&Gを保存して好きなときに見られるようにする

TODO
----

* Materializeでマシな見た目にする
  + サムネイルでカードUIにする
  + カード4枚ごとにrowタグで括るのをどうするか
  + テキストのみのページも出せるようにする？
* 録画スケジュールをWebから変更できるようにする
  + スケジュール情報の取り回しを変える必要あり
  + `schedule.json`の読み込みタイミングを`scheduler.start()`に移動？

Require
----

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

nginx
----

nginxをリバースプロキシとして、ポート80でアクセスできるようにする

`/etc/nginx/conf.d/`に適当な名前で保存

```
upstream mocha {
  # config.jsonに設定したポート番号と合わせる
  server localhost:3001;
}

server {
  listen      80;
  server_name mocha.yourdomain.com;
  charset     UTF-8;
  
  root        /path/to/mocha;
  
  # BASIC認証を掛けるときはコメントアウトを外す
  #auth_basic           "Login message";
  #auth_basic_user_file /path/to/.htpasswd;
  
  location / {
    proxy_redirect                      off;
    proxy_set_header Host               $host;
    proxy_set_header X-Real-IP          $remote_addr;
    proxy_set_header X-Forwarded-Host   $host;
    proxy_set_header X-Forwarded-Server $host;
    proxy_set_header X-Forwarded-For    $proxy_add_x_forwarded_for;
    proxy_pass                          http://mocha/;
  }
}
```
