---
layout: app/_layouts/post.html.ejs
title:  "Docker コンテナ内から他の Docker コンテナに docker exec する"
date:   2017-01-07 10:00:00 +0900
categories: blog docker
description: "Dockerコンテナの中で、Docker Clientは、動くらしくて、ホストOSにある /var/run/docker.sock を共有することで、コンテナ内で、ホストOS側の Docker Client と同じ実行結果になることがわかった。"
tags: 
  - "環境構築"
  - "Docker"
---
フロントエンドの開発環境を整備すべく、 nodejs と ruby が入ったコンテナがないかな？と探したのだけど、オフィシャルなイメージとしては、nodeのコンテナと、rubyのコンテナが、それぞれ単体では存在するが、両方が載っているものがなかったので、オフィシャルじゃないイメージを使うことにした。

その前に、ふと、Dockerコンテナの中で、Dockerコンテナが動くんだろうか？という疑問がよぎった。

できたとしても、親子の入れ子構造にすると、イメージが肥大化するので、兄弟関係で、動かした方がいいんだろうな・・・ということは、なんとなく想像がつくので、コンテナ間で、 docker exec できないものか？と調べてみる・・・。

そして、Dockerコンテナの中で、Docker Clientは、動くらしくて、ホストOSにある /var/run/docker.sock を共有することで、コンテナ内で、ホストOS側の Docker Client と同じ実行結果になることがわかった。  
<http://qiita.com/minamijoyo/items/c937fb4f646dc1ff064a>

ただし、このやり方は、セキュリティ的にリスクがあると警告しているので、本番用には使わないことにした方が良さそうだ。  

さて、実験用のコンテナを、3つ用意する。
* base  
作業用のベースコンテナ（ここに、Docker Clientを入れる）
* node  
nodeが入ってるオフィシャルなコンテナ
* ruby  
rubyが入ってるオフィシャルなコンテナ

まずは作業場となる baseコンテナは、 Dockerfile でビルドする。中には、Docker Client を入れる。

Dockerfile
```
FROM alpine:3.4

ENV DOCKER_CLIENT_VERSION=latest

RUN apk add --update curl bash \
  && rm -rf /var/cache/apk/* \
  && curl -fsSL https://get.docker.com/builds/Linux/x86_64/docker-${DOCKER_CLIENT_VERSION}.tgz > docker.tgz \
  && tar xfz docker.tgz docker/docker \
  && mv docker/docker /usr/local/bin/docker \
  && rm -rf docker \
  && chmod +x /usr/local/bin/docker

```
alpine を使うと、すごくイメージが小さくて、あっという間に build できる。

あとは、 node と ruby のコンテナも必要だが、 Dockerfile は必要ないので、3つのコンテナあわせて、 docker-compose.yml にまとめる。

docker-compose.yml
```
version: '2'

services:
  base:
    build: .
    image: altus5/base:latest
    container_name: base
    command: bash
    tty: true
    working_dir: /srv/app
    ports:
      - "4000:4000"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - .:/srv/app
    depends_on:
      - node
      - ruby

  node:
    image: node:7.3.0-alpine
    container_name: node
    tty: true
    working_dir: /srv/app
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - .:/srv/app

  ruby:
    image: ruby:2.3.3-alpine
    container_name: ruby
    tty: true
    working_dir: /srv/app
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - .:/srv/app

```

そして、次のコマンドで、起動する
```
docker-compose build
docker-compose up -d

```

docker ps で見ると、3つのコンテナが起動していることがわかる。
```
$ docker ps
CONTAINER ID        IMAGE                COMMAND             CREATED             STATUS              PORTS                    NAMES
27dc3a69e82f        altus5/base:latest   "bash"              5 seconds ago       Up 4 seconds        0.0.0.0:4000->4000/tcp   base
4156913e9fb4        node:7.3.0-alpine    "node"              5 minutes ago       Up 5 minutes                                 node
d86a3f65e733        ruby:2.3.3-alpine    "irb"               5 minutes ago       Up 5 minutes                                 ruby

```

さて、baseコンテナの中で、どうやって、 node を使うか説明する。
```
#まずは、baseコンテナに bash で入る

$ docker exec -it base bash

# コンテナ内で、 docker ps してみると

bash-4.3# docker ps
CONTAINER ID        IMAGE                COMMAND             CREATED             STATUS              PORTS                    NAMES
27dc3a69e82f        altus5/base:latest   "bash"              10 minutes ago      Up 10 minutes       0.0.0.0:4000->4000/tcp   base
4156913e9fb4        node:7.3.0-alpine    "node"              16 minutes ago      Up 16 minutes                                node
d86a3f65e733        ruby:2.3.3-alpine    "irb"               16 minutes ago      Up 16 minutes                                ruby

# このとおり、ホストOSの docker の出力と、同じになる

# baseコンテナから、nodeコンテナに exec してみる

bash-4.3# docker exec -it node node -v
v7.3.0

# 例えば、/usr/local/bin/node と npm を次のように、スクリプトを作成しておくと

bash-4.3# echo 'docker exec -it node node $*' > /opt/bin/node
bash-4.3# echo 'docker exec -it node npm $*' > /opt/bin/npm
bash-4.3# chmod +x /opt/bin/*

# baseコンテナの中に、nodeがあるかのように動く

bash-4.3# node -v
v7.3.0
bash-4.3# npm -v
3.10.10

```

実用性があるかどうは、なんとも言えないが、ちょっと、おもしろくないだろうか？  
なるほどねー！と思った人は、きっと、 Docker 好きです。

実用性が・・・と前置きしたのは、node の場合は、やってみると、いろいろ問題が出てきたからである。

npm で global にインストールしたときは、node コンテナの中に、インストールされるので、docker exec の起動シェルを、その都度、作成してあげないといけない。

あと、gulp-sass なんかは、node から child_process で ruby を実行するわけだが、node コンテナの中に、docker exec で ruby を起動させるシェルを配置してあげないといけない。

他にも、bowerとか、rootでの実行が推奨されていないものを、どうする？とか。

特に、最後の bower の課題に気づいたときに、これだと、コンテナ起動後に準備することが多くて、結局、Dockerfile 作った方がいいなぁ・・・と感じられたので、試行錯誤するのをやめた。

でも、nodeは、いろいろ、面倒なのだけど、もう少し、コマンド構成が単純なものであれば、Dockerfileを作らずに、docker-composeだけで、間に合わせるということが、できるので、覚えておくと、使えることがあるかもしれない。

