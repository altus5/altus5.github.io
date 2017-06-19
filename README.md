ALTUS-FIVEサイトの構築キット
===========================

ALTUS-FIVEサイトは、GitHub Pages 用に gulp でサイトイメージを構築します。  
uglify、sass、imagemin、lint などは、[Google Web Starter Kit](https://developers.google.com/web/tools/starter-kit/?hl=ja) をベースに、
ブログ記事は、独自の gulp プラグインで生成しています。

## 初回起動時

vagrant up すると、 [Web Starter Kit の Dockerコンテナ](https://hub.docker.com/r/altus5/web-starter-kit/)が起動して、
gulp が実行できる状態になります。

初回は、コンテナに入って、コンテンツをビルドしてください。
```
sudo docker exec -it wsk bash
npm install
gulp 
```
このコンテナの起動は、 docker-compose で node_modules をデータコンテナに
マウントしているので、一度、npm install したら、コンテナを停止しても、
node_modules は維持されます。  
※詳しくは [コンテナのソースリポジトリ](https://github.com/altus5/docker-web-stater-kit) を参照してください

## ローカルでのデバッグ

gulp serve を実行すると、browser-syncで自動ビルドされてライブリロードされます。  
ブログ記事の追加や、任意のページを追加したときは、ローカルで確認してから、プッシュしてください。

```
gulp serve
```

ブラウザからは、vagrantで起動したVMのIPでアクセスします。
```
http://192.168.66.10:3000/
```
このIPアドレスを hosts ファイルに dev.altus5.local として登録して、
このホスト名で表示すると、会社概要の google map や、問い合わせページの js が
正常に実行されます。
```
http://dev.altus5.local:3000/
```

gulp serve での watch は、リロードされるスピードを優先して、依存関係の追跡は、
"ほどほど" にしています。  
ライブリロードが反応しない場合は、 全体をリビルドしてから、再度、起動してください。  
```
gulp        # gulp の default でリビルドが実行されるようになっています
gulp serve
```

## CircleCI の自動デプロイ

.circleci は、 CircleCI のための設定とデプロイスクリプトです。  
このスクリプトは、以下の git のブランチで構成されていることを前提とします。  

| ブランチ | 説明 |
|:-------:|------|
| draft   | 構築キットのソース。このブランチでコーディングする。 |
| master  | 生成された静的コンテンツがコミットされるブランチ。|

draft ブランチで、 ソースコードを管理し、 gulp によってコンテンツが生成されて、
WEBページとして公開される静的ファイルは、 master ブランチにプッシュされます。
2つのブランチで、それぞれ、異なるファイルを管理します。

## CircleCIとの連携

### Integrationの設定  
* githubの画面の右上のアイコンのプルダウンから、Integrations を選択  
* CircleCI をクリック  
* 画面に従って設定

初期状態では、CircleCIは、リポジトリに対して、プッシュすることができないので、
書き込み権限のあるSSHのキーを登録する。  

### SSHキーの作成  
ローカルで、SSHのキーを作成する  
例)
```
ssh-keygen -t rsa -N "" -f id_rsa.sample
```

### github への公開キーの登録  
https://github.com/アカウント/リポジトリ名/settings/keys  
Integrations の設定で、CircleCIの方でも、このリポジトリを選択していたら、
すでに、CircleCIの登録があるハズだが、これは、読み取り専用なので、
「Add deploy key」ボタンを押して、次のように登録する。  

| 項目 |値|
|:-----:|:-----|
|Title|CircleCI 書き込み  (※なんでもよい) |
|Key  |ssh-keygenで作成した id_rsa.sample.pub の内容を貼り付ける|
|Allow write access| チェック （必須） |
   
### CircleCI への秘密キーの登録
https://circleci.com/gh/アカウント/リポジトリ名/edit#ssh  
「Add SSH Key」ボタンを押して、次のように登録する。 

| 項目 |値|
|:-----:|:-----|
|Hostname|github.com|
|Private Key|ssh-keygenで作成した id_rsa.sample の内容を貼り付ける|

## 自動デプロイ
以上の設定を行うと、 draft ブランチにプッシュする毎に、CircleCI で gulp が実行されて
生成された静的コンテンツが master ブランチにデプロイされます。  
GitHub Pages で公開されているWEBサイトは、ダウンタイム無しで更新されます。  


## ステージングでの最終確認

ステージング環境として、以下のリポジトリを使っています。  
<https://github.com/char-siu-men/char-siu-men.github.io>

このリポジトリにプッシュすると、次のURLで閲覧できます。  
<https://char-siu-men.github.io/>

CircleCIのスクリプトのテストや、本番公開前の確認が必要な場合は、
このリポジトリを使ってください。

また、テストが終わったら、コンテンツを削除してください。  
間違うと痛いので、別のディレクトリに clone してから実行してください。
```
mkdir hoge
cd hoge
git clone git@github.com:char-siu-men/char-siu-men.github.io.git .
find . -maxdepth 1 ! -name '.' ! -name '.git' -exec rm -rf {} \;
git add -fA
git commit --allow-empty -m "$(git log -1 --pretty=%B) [ci skip]"
git push -f origin master
```
