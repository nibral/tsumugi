mocha
====

超!A&Gを保存して好きなときに見られるようにする

Require
----

* node.js
 + 最新版で動作確認しています
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
 + x264とfdk_aacが必要
 + CentOSの場合の手順は[こちら](http://nibral.github.io/ffmpeg-on-centos/)

WebAccess
----

ポート80でアクセスする場合、nginxでリバースプロキシを立てる

下記を`/etc/nginx/conf.d/mocha.conf`として保存

```
upstream mocha {
  server localhost:3000;
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

License
----

(c) 2015 nibral

Released under MIT License.

[http://opensource.org/licenses/mit-license.php](http://opensource.org/licenses/mit-license.php)

