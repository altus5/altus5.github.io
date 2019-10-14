---
layout: app/_layouts/post.html.ejs
title:  "IntelliJ系IDEのインスペクションをCLIで実行する"
date:   2019-10-15 06:00:00 +0900
categories: blog intellij
description: "コーディングスタイルのチェックを linter とかじゃなくて、 IntelliJ の インスペクションに委ねている開発チーム向けに、IDEを起動することなく、コマンドラインから、IntelliJ の インスペクションを実行する方法をご紹介します。CI環境でのインスペクションにも使えるんじゃないでしょうか？"
tags:
- "CI"
- "PhpStorm"
- "IntelliJ"
- "インスペクション"
---

今参加しているプロジェクトは、 PhpStorm が推奨IDEとなっています。  
コードの品質と統一感を維持するために、IDEのインスペクション機能が活用されているのですが、私は、ほとんど IntelliJ 系のエディタを使って来なかったので、 VSCode で開発してコミットする前に、 PhpStorm を起動して、最終チェックをするという使い方をしてました。  
でも、普段使いをしていないので、結構、チェックが漏れるんですね。コードレビューで、"IDEの警告が出てます！"という指摘をモリモリいただいて、申し訳ない気持ちになることが、何度もありました。  
PhpStorm を使え！っていうことなんですけど、エディタを変えたくないので、どうにかできないものか？と思案したお話です。

結論としては、 **CIでインスペクションしてエラーを返してくれたらいい** ということなんですけど、そのためには、 PhpStorm のインスペクションが、コマンドラインから実行できないといけません。  
以降では、 PhpStorm を CLI で実行する方法を中心に記載します。  
調べてみると、 IntelliJ 系 IDE は、すべてこのやり方が使えることがわかりました。  
PhpStorm だけじゃなくて、 IntelliJ を使っている方々の CI 環境の構築に、お役立てください。

私が、主に参考にした記事は、こちらです。合わせて読んでみてください。
* https://pleiades.io/help/idea/command-line-code-inspector.html
* https://www.christianscheb.de/archives/808

## (1) Linux版のダウンロード

CI で実行するので、Linux版を使います。  
以下からダウンロードできます。  
https://www.jetbrains.com/PhpStorm/download/#section=linux

この記事では、最終的には、Dockerコンテナで動かすので、Dockerが使えれば、WindowsでもMacでも、どの環境にも共通です。

Dockerfileからダイレクトにダウンロードするなら、このURLです。  
https://download-cf.jetbrains.com/webide/PhpStorm-2019.2.1.tar.gz


## (2) IntelliJ の CLI 機能

コマンドラインから実行できる機能は、公式マニュアルにありました。  
CI で使えそうな機能は、この2つです。

* コードインスペクションを起動する  
    https://pleiades.io/help/idea/command-line-code-inspector.html
* ファイルをフォーマットする  
    https://pleiades.io/help/idea/command-line-formatter.html

ファイルのフォーマットも、自動化すると、楽ができることがあるかもしれないので、また別の機会に試してみるとして、コードインスペクションについて、詳しく見ていきます。

tar.gz を解凍してみると、 bin ディレクトリの下に、コマンドがありました。
```
PhpStorm-192.6262.66
├─bin
│      format.sh
│      inspect.sh
```

## (3) ライセンス

ライセンスの登録は、GUIがないとできません。  
私の場合は、Windows版でライセンスの登録をして、作成されたライセンスファイルを Linux版でも使っています。  
同時に起動していなければ、複数マシンにインストールしても問題ないようです。（ライセンス違反ではない）

ライセンスファイルは、このあたりに作成されます。（PhpStormのバージョンによって変わってそうです）
```
%USERPROFILE%\.PhpStorm2019.2\config\PhpStorm.key
```

## (4) Dockerコンテナ化

PhpStorm を Docker と docker-compose で動かします。
dockerイメージも作りますが、 openjdk のイメージ に Linux 版の PhpStorm をダウンロードして、 /opt/PhpStorm/ にインストールしただけのシンプルなもので、必要な設定ファイルなどは、docker-compose.yml の volumes で置き換える感じにします。

PHPのプロジェクトのルート直下に、こんな構成で作成します。
```
$PROJECT_ROOT
│  .env
│  docker-compose.yml 
├─phpstorm
│      Dockerfile
│      idea.properties
│      phpstorm.key           # ライセンスファイルをコピーしておく
```

### ./.env

docker-compose用のenvです。
Laravelのように、フレームワークが、.envを使っている場合は、それに含めてしまってもよいと思います。あるいは、docker-compose.ymlの中に直接書いても問題ありません。

```bash
# プロジェクトのルート
PROJECT_PATH=/app
# インスペクション結果の出力先
INSPECTION_OUTPUT_PATH=/app/inspection-output
# .ideaの中にあるプロファイルのパス
INSPECTION_PROFILE_PATH=/app/.idea/inspectionProfiles/Project_Default.xml
```
※ここのパスは、コンテナ内のパス


### ./docker-compose.yml

```yml
version: '2'
services:
  # phpstormでinspectionをcliで実行する
  # @see https://www.christianscheb.de/archives/808
  # /opt/PhpStorm に phpstorm をインストールして
  # /opt/PhpStorm/profile に実行時に作成されるデータが置かれるように
  # idea.properties で設定する。
  # /opt/PhpStorm/profile は data コンテナで保持し、再利用できるようにしておく。
  # ただし、ライセンスキー（phpstorm.key）置き場は、dataコンテナでマウントしたパス上にあるので、
  # 再マウントして置き換える。（profile_data と ./phpstorm.key の定義順が重要）
  inspect:
    image: phpstorm
    build: ./phpstorm
    volumes:
      # dataコンテナ（永続化が必要なデータ）
      ## profileのディレクトリはdataコンテナで保持
      - profile_data:/opt/PhpStorm/profile
      ## .javaディレクトリもdataコンテナで保持
      ## phpstormが使ってるようで保持してないと毎回警告が出てしまうので。
      - java_data:/root/.java

      # プロジェクトroot -> /app
      - .:/app
      # phpstormの構成をデフォルトから設定変更する
      - ./phpstorm/idea.properties:/opt/PhpStorm/bin/idea.properties
      # phpstormのライセンスキー
      - ./phpstorm/phpstorm.key:/opt/PhpStorm/profile/config/phpstorm.key
    working_dir: /app
    command: inspact.sh ${PROJECT_PATH} ${INSPECTION_PROFILE_PATH} ${INSPECTION_OUTPUT_PATH} -v2

volumes:
  profile_data:
    driver: local
  java_data:
    driver: local
```

### ./phpstorm/Dockerfile

```docker
FROM openjdk:11

RUN curl -O -L https://download-cf.jetbrains.com/webide/PhpStorm-2019.2.1.tar.gz
RUN tar xvfz PhpStorm-2019.2.1.tar.gz
RUN mkdir -p /opt/PhpStorm
RUN mv PhpStorm-*/* /opt/PhpStorm/
RUN rm -rf PhpStorm-*

ENV PATH $PATH:/opt/PhpStorm/bin

CMD ["/opt/PhpStorm/bin/inspect.sh"]
```

### ./phpstorm/idea.properties

```
idea.config.path=${idea.home.path}/profile/config
idea.system.path=${idea.home.path}/profile/system
idea.plugins.path=${idea.home.path}/profile/plugins
idea.log.path=${idea.home.path}/profile/log

idea.analyze.scope=MyScope              # scope の説明は後述します
```

## (5) scope を作成する

プロジェクト全体をインスペクションの範囲にするなら特別な設定は必要ないのだけど、
フレームワークが違えばディレクトリ構成も違うし、私が参加したプロジェクトでは、インスペクションを導入する前に作成された古いコードが混在していて、そこは除外したいものになっていました。
  
ほとんどの場合で、インスペクションする範囲を設定することになると思いますが、それを可能にするのが、スコープという機能です。  
スコープは、PhpStormのGUI上で設定します。（→[公式マニュアルのページ](https://pleiades.io/help/phpstorm/settings-scopes.html)）

設定した内容を、スコープ名を例えば MyScope として保存すると、以下にXMLが作成されます。

`.idea/scopes/MyScope.xml`

CIで使うためには `.idea` ディレクト配下のこのファイルも git にコミットしておく必要があります。

### CLIからの実行で、スコープを指定する方法

idea.properties に idea.analyze.scope という項目があります。ここに指定したいスコープ名を設定します。

※以下の記事を参考にしました。  
<https://stackoverflow.com/questions/37419162/how-to-run-custom-intellij-inspections-from-terminal>

## (6) インスペクションを実行する

```bash
docker-compose run --rm inspect
```

## (7) 結果解析

インスペクションの結果は、 `.env` 内で指定していますが、 `~/inspection-output` にXMLっぽいファイルで、出力されます。

例) PhpDeprecationInspection.xml  
```xml
<problem>
  <file>file://$PROJECT_DIR$/controllers/HelloController.php</file>
  <line>113</line>
  <module>learningware</module>
  <entry_point TYPE="file" FQNAME="file://$PROJECT_DIR$/controllers/HelloController.php" />
  <problem_class severity="WEAK WARNING" attribute_key="DEPRECATED_ATTRIBUTES">Deprecated</problem_class>
  <description>Class User is deprecated</description>
</problem>
</problems>
```

一見、XMLのように見えるんですが、先頭に `<problems>` が無いので、XMLとしては parse エラーになります。なぜ、こんな形式でファイルを作成しているのかは、ちょっとわからないのですが、仮に、XMLとして正しい形式で出力されていても、このままでは、見づらいし、 CI で結果解析するのは、ひと手間必要です。

### 結果解析用のツール

ということで、このXMLっぽいファイルを解析して、コンソールに出力するツールを使います。  
https://github.com/altus5/idea-inspection-support

準備（初回1回だけ）
```
npm init
npm install altus5/idea-inspection-support --save-dev
```
ここで作成された package.json は CI で使うためにコミットしておきます。

解析実行します。
```
INSPECTION_OUTPUT_PATH=~/inspection-output

npx idea-inspection-support report $INSPECTION_OUTPUT_PATH
```

インスペクションは実行する前に、結果出力ディレクトリの中を削除してから実行してください。エラーじゃないときに、XMLが出力されないため、エラーがあったときのXMLが残ったままになるので、解消したはずのエラーを検出し続けてしまいます。

また、解析するエラーレベルは、固定で実装されています。小さいコードなので、Forkしたり、コピーして自分用に改良して、ご利用ください。

ちなみに、このツールには、ほかにも、スコープを自動生成する処理などもあります。
jsonファイルでインスペクション対象のファイルパターンを書いて、それからスコープを作成する処理なんですが、 PhpStorm を普段づかいしていないチームの場合、json書いてスコープ作成・・・の方が楽かもしれません。[ツールのgithub](https://github.com/altus5/idea-inspection-support)も合わせて読んでみてください。

## まとめ

みなさんのプロジェクトでも、品質を保つための工夫の1つとして、 CI 環境で PhpStorm のインスペクションを実行してみると、良いことがあるかもしれません。  
ご参考までに。
