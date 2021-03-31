---
layout: app/_layouts/post.html.ejs
title:  "AWS でサーバーレスのシステムを Chalice で構築した"
date:   2020-06-06 10:00:00 +0900
categories: blog etl
description: "AWS でサーバーレスのシステムを Python で構築するときに使った Chalice というフレームワークを使いました。"
tags:
- "AWS"
- "Chalice"
- "サーバーレス"
---

AWS にサーバーレスのシステムを Chalice というフレームワークで構築しました。  
AWS も GCP も何を始めるにも、一番早く提供される環境は、 Python 用の環境です。  
Chalice も Python の AWS Lambda 用 のライブラリです。  
Lambda に API Gateway を組み合わせて、手っ取り早く REST API を作ることができます。

## はじめに

Chalice は AWS の公式の記事でも、たくさん紹介されています。  

- [爆速 API 開発を実現するサーバーレスアプリケーション開発向けフレームワーク](https://aws.amazon.com/jp/builders-flash/202003/chalice-api/)
- [【お手軽ハンズオンで AWS を学ぶ】サーバーレスな RESTful API を構築しよう！ Chaliceで実現する Python アプリ開発](https://aws.amazon.com/jp/blogs/startup/event-report-chalice-handson/)

このあたりを、一回読んで、試してみることをお勧めします。  
AWSコンソールでの設定が自動化されてて、AWSに不慣れでも、楽に壁を超えられます。

## ジョブの作成

ジョブの作成手順です。

* AWSコンソールのGlueを開く
* サイドメニューの「ジョブ」 を選択
* 「ジョブの追加」ボタン押下
    * **名前**
      任意に名前をつける。ジョブ実行時の指定の使われる。
    * **IAMロール**
      選択する（無ければ作成）
    * **Type**
      Spark
    * **Glue Version**
      Spark 2.4 （Glue Version 1.0）
    * **このジョブ実行**
      ユーザーが作成する新しいスクリプト
    * **スクリプトファイル名**
      e.g.) example.py
    * **スクリプトが保存されている S3 パス**
        * s3://my-data/glue-scripts
    * **一時ディレクトリ**
        * s3://my-data/glue-temporary

    以上を設定して、「次へ」      

* 「接続」の画面では、何も追加しないで、「ジョブを保存してスクリプトを編集する」ボタン押下
* 「スクリプト編集」の画面では、何も書かずに、「保存」ボタンを押下

これで、ジョブだけ登録されたので、実際のスクリプトは、ローカルでデバッグしたものを、上記の S3パスとスクリプトファイル名 に上書きコピーしてデプロイします。

## Glue をローカルでデバッグする

Glue を docker で実行できるようにしました。詳細は、こちらの記事「[AWS Glueのローカル環境を作成する](https://www.altus5.co.jp/blog/etl/2020/05/07/aws-glue/)」に書いているので、読んでみてください。  

作成した dockerイメージは、altus5/devcontainer-glue で公開してあります。（buildしなくて大丈夫）

docker-compose に glue というサービスで起動するようになっているので、次のようにコンテナに入って実行できます。

```bash
docker-compose exec glue bash
```

以降の説明は、特に指定がないものは、この glue コンテナの中で実行するものとします。

### 小さいテストデータの作り方

ローカルの開発では、小さいデータを用意して、サクサク開発した方がよいでしょう。

例えば、変換元の hogelog という CSV があって、それを開発時のデータとして小さく編集して使おうという場合  

```bash
## s3にある変換元データを持ってくる
aws s3 cp s3://my-data/hogelog/dt=2019-09-01/hogelog_v2_20190901-000.csv.gz .
## デバッグ用なので100行に小さくする
gzip -dc hogelog_v2_20190901-000.csv.gz | head -100 > hogelog_v2_20190901-000.csv
## ./fixture/srcdata/hogelog に移動
mkdir -p ./fixture/srcdata/hogelog
mv hogelog_v2_20190901-000.csv ./fixture/srcdata/hogelog
gzip ./fixture/srcdata/hogelog/hogelog_v2_20190901-000.csv
```

### ローカルで AWS 無しで開発する

ローカルで実行できる前提があると、最初の1歩の踏み出しが楽になります。  

ローカルのデータは、 `file://` スキーマで URL を指定すると Spark はローカルから読み出します。  
出力も同じくローカルに出力できます。そして、最初は、 Parquet 形式ではなくて csv で出力して、出力された値を目で確認できた方がよいでしょう。  
いろいろ使い分けてデバッグしてみてください。

実装例

```python
import io
import sys
import csv
import logging
import datetime
from awsglue.job import Job
from awsglue.transforms import *
from awsglue.context import GlueContext
from awsglue.utils import getResolvedOptions
from pyspark.sql import SQLContext
from pyspark.context import SparkContext
from pyspark.sql.types import StructType
from pyspark.sql.types import StructField
from pyspark.sql.types import StringType
from pyspark.sql.types import IntegerType
from pyspark.sql.types import BooleanType
from pyspark.sql.functions import *

# @params: [JOB_NAME]
args = getResolvedOptions(sys.argv, ['JOB_NAME'])

# ジョブ初期化
sc = SparkContext()
sqlContext = SQLContext(sc)
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args['JOB_NAME'], args)
logger = glueContext.get_logger()

# ローカルのテストデータを読み込む
df = spark.read.csv(
    "file:///workspace/fixture/srcdata/hogelog/*.gz", header=True, sep=",")

# ・・・・
# ロジック
# ・・・・

# ローカルに保存する
(df
    .write
    .mode("overwrite")
    #.format("parquet")
    .format("com.databricks.spark.csv")
    .save("file:///workspace/.dstdata/hogelog/"))

# ジョブコミット
job.commit()
```

Glue にスクリプトを実行させる。  
上記の実装例を `./glue-scripts/example.py` に保存してあるものとします。

```bash
gluesparksubmit \
    ./glue-scripts/example.py \
    --JOB_NAME='dummy'
```

### AWS を使って開発する

データの入力元、出力先を、実際の AWS 環境を使って、テストする方法です。  
各自の credentials を環境変数に設定して、 Glue を実行します。  

上記の example.py の `file://` で指定したデータのURLは、 `s3://` などの実際の環境にあわせて変えます。

```bash
export AWS_ACCESS_KEY_ID=XXXXXXXXXXXXXX
export AWS_SECRET_ACCESS_KEY=YYYYYYYYYYY
export AWS_REGION=ap-northeast-1

# Glue 実行
gluesparksubmit \
    ./glue-scripts/example.py \
    --JOB_NAME='dummy' \

```

これで、 S3 の 出力先に出力されたことを確認できると思います。
