---
layout: app/_layouts/post.html.ejs
title:  "Github Wiki(マークダウン)とConfluenceのWikiマークアップを同期する"
date:   2019-04-29 10:00:00 +0900
categories: blog document
description: "マークダウンで記述したドキュメントを Confluence の wiki マークアップに変換して、且つ、 Confluence API で、ページを post します。"
tags:
- "仕様書"
- "マークダウン"
- "Confluence"
- "a5doc"
---

今参加しているプロジェクトでは、Confluence が使われています。  
ドキュメントを共有するという仕組みとしては、とてもよいサービスだと思います。  
特に、非エンジニア視点で、さまざまな表現力で文書を書けるので、エンジニア側の都合を無理強いすることもなく、立ち位置の違う人たちが共有するものとして、適していると思います。

## テキストエディタでドキュメントを書きたい

**でも**、以前、[仕様書をマークダウンで書きたい](https://www.altus5.co.jp/blog/document/2018/10/13/write-spec-with-markdown/)という記事を書きましたが、エンジニアは、テキストエディタでドキュメントを書きたいので、しっくり来ない点も多々あるんです。

どの辺が不満かと言うと、まずは、 Confluence の wiki マークアップというのが、 textile の記法に近い感じで、マークダウンじゃないというところ。  

Confluence のアドオン機能でマークダウンの記事も投稿できるのだけど、手元のエディタで書いたドキュメントを Confluence のマークダウン記事投稿画面に貼り付けないといけないので、なんだか心地よくないです。
**git commit から push で投稿したい**ですよね。  
ついでに、アドオン機能のマークダウンだと、マークダウンの文書間のリンクが、そのまま Confluence のページ間のリンクにならないんです。
Confluence のページが相対パスで指定するものじゃないので、そりゃそうなんだけど・・・、イマイチなんです。

## Confluence と github wiki の同期

ユーザーと共有するドキュメントは、Confluence なんだけど、開発チーム内では、github  の wiki で仕様書を書いているので、何か、同期するようなツールがないかなぁと、探してみたのだけど、ピッタリのツールは見つけられなかったです。ニッチすぎますからね、そりゃそうです。

それならば！ということで、ツールを作ることにしました。

ツールのポイントは、3つです。
* オリジナルのドキュメントは、マークダウンで書いていて、github wikiでバージョン管理する
* Confluence の画面を開いてテキストを貼り付ける的なことは止めたい 
* Confluence 上でも、ドキュメント間のリンクが再現されること  

### テキストの貼り付けを止めるには？

何ページも、この操作をするのは、やりたくないので、マークダウンを Confluence wiki マークアップに変換して、 Confluence API でコマンドラインから、投稿することにしました。  
探してみると、使えそうなものがいくつか見つかりました。
さすがに要求ピッタリのツールは無かったので、足りない部分は、専用の cli を自作することにしました。

* [markdown2confluence-cws](https://www.npmjs.com/package/markdown2confluence-cws)  
    nodejs製のツールです。これで、マークダウンを Confluence wiki マークアップに変換します。  

* [confluence-api](https://github.com/a5doc/confluence-api.git)  
    Confluence の API のラッパーライブラリです。  
    <https://github.com/johnpduane/confluence-api> から fork したものです。一部のAPIがエラーで動かなかったので、修正して使っています。

* [専用cliツール](https://github.com/a5doc/md2confluence)  
    上記の2つを使って、パラメータで指定されたmdファイルを変換して、APIで投稿するツールです。  

### ドキュメント間のリンクをどうするか？

Confluence のドキュメントは、ページタイトルがユニークになっているので、ページタイトルでリンクを張るようになっています。
wikiのリンクと言えば、この仕様の方が普通で、 redmine の wiki も backlog の wiki もこれです。  
github wiki のmdファイルの相対パスでリンクを張る方が、wiki としては特殊なんだと思います。  
また、Confluence の wiki の階層構造は、親ページを設定することで、表現しています。

いくつかやってみて、専用 cli の中でリンクを変換するやり方に落ち着きました。ついでにリンク切れチェックなんかもできました。  
そして、Confluence 上のドキュメントは、ユーザー側でも、いろんな書類を作成しているので、開発側都合のページタイトルや階層をそのままにできないところもあり、マークダウンのドキュメントの中に、 Confluence 上でのページ名と親ページ名を [Front-matter](https://jekyllrb-ja.github.io/docs/frontmatter/) で持たせておくことにしました。

こんな感じです。
```md
---
title: アカウント管理画面
parent: 画面仕様
---

**機能概要:**
アカウント管理画面の仕様について記載する。

**入力:** 
* パラメータ1
* パラメータ2
* パラメータ3

**処理詳細:** 

・・・・
```

Front-matter は、静的Webサイトジェネレータの[jekyll](https://jekyllrb-ja.github.io/)でも使われていて、jekyllは、githubにblogを公開するツールなので、考え方としても、相性が良さそうです。


## モヤモヤ解消

以上、開発チーム内では、マークダウンでドキュメントを書いて、gitで文書を管理しつつ、プロジェクト全体の共有文書としては、Confluenceに専用のcliツールで同期する方法をご紹介しました。

実際に、文書を投稿するときの cli は、こんな感じです。
```bash
vi docs/hoge.md
git add docs/hoge.md
git commit -m "update hoge"
git push origin master
npm run md2c docs/hoge.md  # これが専用cliツール
```
Confluenceの投稿画面を開いて、テキストを貼り付けるっていうモヤモヤが、少しは解消されるんじゃないでしょうか。

専用cliについては、githubで公開しているので、詳しくは、そちらも参照してみてください。  
<https://github.com/a5doc/md2confluence>

