---
layout: app/_layouts/post.html.ejs
title:  AWSのエラーログ監視の設定
date:   2020-09-07 09:00:00 +0900
categories: blog etl
description: "AWSにサーバーレスなシステムを構築したときのログ監視のやり方を説明します。簡単に再利用できるようにできるだけCLIで設定します。"
tags:
- "AWS"
- "サーバーレス"
- "ログ監視"
---

AWS に サーバーレスなシステムを構築したときのログは、 CloudWatch Logs を使うことになりますが、エラーログの監視設定をするときの手順をご紹介します。  

AWS コンソール画面から設定するやり方は、他にも、たくさん記事があるので、本記事では、 コピペで再利用できるように aws cli で設定するやり方で説明します。

大まかな、設定手順は、次のとおりです。

1) SNSトピックを作成  
2) SNSトピックにサブスクライバーとしてエラー通知先を登録  
3) CloudWatch のロググループにメトリクスを作成  
4) メトリクスのアラームとして検出する閾値を設定して、アラーム時のアクションをSNSトピックにする  

実際にエラーが検出されると、こんな感じで流れます。

a) ログに "ERROR" の文字列で見つかる  
b) 対象ロググループのメトリクスフィルタでアラームになる条件が満たされると、  
c) メトリクスのアクションが実行されて、SNSトピックに投稿される  
d) SNSトピックのサブスクライバーとなっているメールアドレスに配信される  

## 設定

実際の設定内容です。

### SNSトピックの作成

CloudWatch Alarm からの投稿先となる SNSトピック を作成します。  
また、このトピックのサブスクライバーとして、エラー通知先のメールアドレスを登録します。

```bash
export AWS_PROFILE=default
export AWS_ACCOUNT_ID=111111111111
export REGION=ap-northeast-1

# SNSトピック名
## CloudWatch Alarm から投稿されるトピック
SNS_TOPIC_ALARM=MyAppAlarmTopic

# SNS トピックの作成
aws sns create-topic \
    --name $SNS_TOPIC_ALARM

# トピックへのサブスクライブの登録
aws sns subscribe \
    --topic-arn arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_ALARM} \
    --protocol email \
    --notification-endpoint error@example.com

```

しばらくすると AWS Notification - Subscription Confirmation という件名のメールが来ます。本文を確認して Confirm を行ってください。

ちなみに、何回か設定を修正することになると思うので、削除するときのコマンドも載せておきます。

**※設定修正のための削除コマンド**

```bash
# トピックの削除
aws sns delete-topic \
    --topic-arn arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_ALARM}

```

**※設定修正のための解除コマンド**  
サブスクライブを解除するときは、サブスクライブの一覧で ARN を取得してから削除します。

```bash
# 一覧取得
aws sns list-subscriptions

## 対象の ARN を指定して解除する
SUBSCRIPTION_ARN=arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_ALARM}:xxxxxx-xxxx-xxxx-xxxx-xxxxxxxx
aws sns unsubscribe \
    --subscription-arn $SUBSCRIPTION_ARN
```

### CloudWatch Logs のメトリクスフィルタを作成

ロググループ=/aws/lambda/api-hello-world で "ERROR" という文字列を検出する場合の設定です。

```bash
LOG_GROUP_NAME=/aws/lambda/api-hello-world
METRIC_NS=MyAppLog
METRIC_NAME="MyAppLogMetric_${LOG_GROUP_NAME}"
FILTER_NAME=ERROR

# メトリクスフィルタを作成
aws logs put-metric-filter \
    --log-group-name ${LOG_GROUP_NAME} \
    --filter-name ${FILTER_NAME} \
    --filter-pattern 'ERROR' \
    --metric-transformations \
    metricNamespace=${METRIC_NS},metricName=${METRIC_NAME},metricValue=1,defaultValue=0

```

**※設定修正のための削除コマンド**  

```bash
aws logs delete-metric-filter \
    --log-group-name ${LOG_GROUP_NAME} \
    --filter-name ${FILTER_NAME}
```

### メトリクスフィルタにアラームを作成

このアラームで、エラー検出の閾値の設定と、エラー検出時のアクションとして、SNSトピックへの投稿を登録します。

```bash
ALARM_NAME="Alarm-$LOG_GROUP_NAME"

# メトリクスフィルタにアラームを作成
aws cloudwatch put-metric-alarm \
    --alarm-name ${ALARM_NAME} \
    --alarm-description "${LOG_GROUP_NAME} のログにエラー" \
    --alarm-actions arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_ALARM} \
    --metric-name ${METRIC_NAME} \
    --namespace ${METRIC_NS} \
    --statistic Sum \
    --period 60 \
    --evaluation-periods 1 \
    --datapoints-to-alarm 1 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --treat-missing-data notBreaching

```

**※設定修正のための削除コマンド**  

```bash
aws cloudwatch delete-alarms \
    --alarm-names ${ALARM_NAME}
```

### 確認

ログを書き込んでメール通知されることを確認します。  
ログストリームの作成が必要ですが、なんでもよいので、 "test" というログストリームを作ります。

```bash
# テスト用のログストリームを作成する
LOG_STREMA_NAME=test
aws logs create-log-stream \
    --log-group-name ${LOG_GROUP_NAME} \
    --log-stream-name ${LOG_STREMA_NAME}

# エラーログを書き込む
CURRENT_TIME_MS=$(($(date +%s%N)/1000000))
aws logs put-log-events \
    --log-group-name ${LOG_GROUP_NAME} \
    --log-stream-name ${LOG_STREMA_NAME} \
    --log-events timestamp=$CURRENT_TIME_MS,message='ERROR test'

```

監視の間隔を60秒に設定しているので、60秒くらい待って、メールを確認します。  
メール通知が確認できたら、 "test" ログストリームを削除します

```bash
aws logs delete-log-stream \
    --log-group-name ${LOG_GROUP_NAME} \
    --log-stream-name ${LOG_STREMA_NAME}

```

実際に、メール配信される通知内容の例です。

```
You are receiving this email because your Amazon CloudWatch Alarm "Alarm-/aws/lambda/hello-world" in the Asia Pacific (Tokyo) region has entered the ALARM state, because "Threshold Crossed: 1 out of the last 1 datapoints [1.0 (07/09/20 04:00:00)] was greater than or equal to the threshold (1.0) (minimum 1 datapoint for OK -> ALARM transition)." at "Monday 07 September, 2020 04:01:21 UTC".

View this alarm in the AWS Management Console:
https://ap-northeast-1.console.aws.amazon.com/cloudwatch/xxxxxxxxxxxxxxxx

Alarm Details:
- Name:                       Alarm-/aws/lambda/hello-world
- Description:                /aws/lambda/hello-world のログにエラー
- State Change:               OK -> ALARM
- Reason for State Change:    Threshold Crossed: 1 out of the last 1 datapoints [1.0 (07/09/20 04:00:00)] was greater than or equal to the threshold (1.0) (minimum 1 datapoint for OK -> ALARM transition).
- Timestamp:                  Monday 07 September, 2020 04:01:21 UTC
- AWS Account:                11111111111111111
- Alarm Arn:                  arn:aws:cloudwatch:ap-northeast-1:11111111111111111:alarm:Alarm-/aws/lambda/hello-world

Threshold:
- The alarm is in the ALARM state when the metric is GreaterThanOrEqualToThreshold 1.0 for 60 seconds.

Monitored Metric:
- MetricNamespace:                     MyAppLog
- MetricName:                          MyAppLogMetric_/aws/lambda/hello-world
- Dimensions:                         
- Period:                              60 seconds
- Statistic:                           Sum
- Unit:                                not specified
- TreatMissingData:                    notBreaching


State Change Actions:
- OK:
- ALARM: [arn:aws:sns:ap-northeast-1:11111111111111111:MyAppAlarmTopic]
- INSUFFICIENT_DATA:

```

## エラーログの詳細を再通知する仕組みの追加

通知内容は、上記のような感じです。

確かにアラーム状態になったことは分かるのだけど、エラーログそのものが提示されてません。
そのため、 CloudWatch の Logを見に行かないといけないです。  
それが面倒だという場合は、アラーム通知をLambda関数でサブスクライブして、CloudWatch の Log を抽出して、別のSNSトピックで再通知するという方法が、以下の記事で紹介されているので、参考にするとよいとい思います。  
<https://dev.classmethod.jp/articles/notification_cloudwatchlogs_from_sns/>

以下は、この参考記事の内容を、aws cli でやっています。

### ログ詳細通知用のトピックを作成

```bash
# トピックを作成
SNS_TOPIC_LOG_DETAIL=MyAppLogDetailTopic
aws sns create-topic \
    --name $SNS_TOPIC_LOG_DETAIL

# トピックへのサブスクライブの登録
aws sns subscribe \
    --topic-arn arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_LOG_DETAIL} \
    --protocol email \
    --notification-endpoint error@example.com

```

しばらくすると AWS Notification - Subscription Confirmation という件名のメールが来ます。本文を確認して Confirm を行ってください。

### サブスクライブする Lambda 関数用の Role の作成

```bash
ROLE_NAME=MyAppLambdaSnsRole
aws iam create-role --role-name ${ROLE_NAME} \
    --assume-role-policy-document file://trust-policy.json

# ロールに基本的な Lambda 実行権限と CloudWatchLogsReadOnlyAccess と AmazonSNSFullAccess を付与
POLICY1=arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
POLICY2=arn:aws:iam::aws:policy/CloudWatchLogsReadOnlyAccess
POLICY3=arn:aws:iam::aws:policy/AmazonSNSFullAccess
aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn $POLICY1
aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn $POLICY2
aws iam attach-role-policy --role-name ${ROLE_NAME} --policy-arn $POLICY3
```

**※もし作り直すなら**

```bash
aws iam detach-role-policy --role-name ${ROLE_NAME} --policy-arn $POLICY1
aws iam detach-role-policy --role-name ${ROLE_NAME} --policy-arn $POLICY2
aws iam detach-role-policy --role-name ${ROLE_NAME} --policy-arn $POLICY3
aws iam delete-role --role-name ${ROLE_NAME}
```

### lambda関数を作成

[こちらの記事](https://dev.classmethod.jp/articles/notification_cloudwatchlogs_from_sns/)にあるlambda関数をそのまま sns_handler.py として保存してください。

lambda関数の処理は、アラートの通知トピックがパラメータで入ってくるので、それを条件に CloudWatch Logs から該当するログを検索して、ログ詳細通知トピックに投稿する処理です。

```bash
# lambdaのコードをzipにする
zip -r sns_handler.zip sns_handler.py

# 作成
LAMBDA_FUNCNAME=sns_handler
SNS_TOPIC_LOG_DETAIL_ARN=arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_LOG_DETAIL}
ENVIROMENT="Variables={SNS_TOPIC_ARN=$SNS_TOPIC_LOG_DETAIL_ARN}"
aws lambda create-function \
    --function-name ${LAMBDA_FUNCNAME} \
    --runtime python3.6 \
    --zip-file fileb://sns_handler.zip \
    --handler ${LAMBDA_FUNCNAME}.lambda_handler \
    --environment $ENVIROMENT \
    --timeout 60 \
    --role arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}

# zipはもう不要なので削除
rm -f sns_handler.zip

```

**※もし作り直すなら**  

```bash
aws lambda delete-function \
    --function-name ${LAMBDA_FUNCNAME}
```

### アラーム通知トピックへの lambda のサブスクライブの登録

作成した lambda 関数と、もともとのアラーム通知トピックと紐づけます。
これによって、アラームのトピックに通知があると、 lambda関数 がトリガーされて、そのときの event パラメータにトピックの内容が渡されるようになります。

尚、lambda 関数を作り直したら、以下のコマンドも毎回再設定してください。

```bash
# トピックのサブスクライバーとしてlambda関数を登録
aws sns subscribe \
    --topic-arn arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_ALARM} \
    --protocol lambda \
    --notification-endpoint arn:aws:lambda:${REGION}:${AWS_ACCOUNT_ID}:function:${LAMBDA_FUNCNAME}

# SNSトピックからトリガー起動されるための設定
aws lambda add-permission \
    --function-name ${LAMBDA_FUNCNAME} \
    --source-arn arn:aws:sns:${REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_ALARM} \
    --statement-id ${LAMBDA_FUNCNAME} \
    --action "lambda:InvokeFunction" \
    --principal sns.amazonaws.com

```

## まとめ

エラーログ監視の設定が、開発の本質的な作業かというと、ちょっと違うと思います。  
でも、こういうものの設定にも、その設定方法を調べることに、多くの時間が割かれます。  
だから、ついつい、先送りにしてしまうんですが、上記のようなコピペの元があると、最初の開発環境の一部として設定して、開発時のデバッグのために活用できるのではないでしょうか？  
