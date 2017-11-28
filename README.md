**このプロジェクトはもう使われていません THIS PROJECT IS NO LONGER MAINTAINED**

tsumugi
====

超!A&Gを保存して好きなときに見られるようにする

Versions
----

* v1.0 : 時間を指定して特定の番組のみ保存
* v2.0 : 公式HPの番組表を元に全ての番組を保存

Require
----

* node.js
* rtmpdump
```
sudo yum install openssl-devel
wget http://rtmpdump.mplayerhq.hu/download/rtmpdump-2.3.tgz
tar xzf rtmpdump-2.3.tgz
cd rtmpdump-2.3
make SYS=posix
sudo cp -p rtmpdump rtmpgw rtmpsrv rtmpsuck /usr/local/bin
```
* ffmpeg
 + x264とfdk_aacを使ってるので自前でビルドしてください
 + CentOSの場合の手順は[こちら](http://nibral.github.io/ffmpeg-on-centos/)

WebAccess
----

ポート80でアクセスする場合、nginxでリバースプロキシを立てるとよい

設定ファイルの例

```
upstream tsumugi {
  server localhost:3000;
}

server {
  listen      80;
  server_name tsumugi.yourdomain.com;
  charset     UTF-8;

  root        /path/to/tsumugi;

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
    proxy_pass                          http://tsumugi/;
  }
}
```

License
----

(c) 2015 nibral

Released under MIT License.

[http://opensource.org/licenses/mit-license.php](http://opensource.org/licenses/mit-license.php)

