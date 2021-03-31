---
layout: app/_layouts/post.html.ejs
title:  小さい組織ほど IaC に取り組むべき
date:   2021-01-30 09:00:00 +0900
categories: blog iac terraform
description: "SlackのChatbotをMS製のBot Frameworkで作成してみました。簡単に作り方を説明します。"
tags:
- "AWS"
- "IaC"
- "Terraform"
---

小さいシステムの場合、インフラも含めてシステム開発をご依頼いただくことがありますが、4～5年位前までは、せいぜいが、 AWS に EC2 と RDS を構築する程度のことが、ほとんどでしたが、マネージドサービスが拡充されるにつれ、クラウド上のサービスを組み合わせたシステム構成が増えるようになって、インフラ構成が複雑になってきています。  
EC2 と RDS だけなら、設定内容をドキュメントに残してシステムの復元性を担保できたわけですが、利用サービスの設定や、各種権限設定、それらの繋ぎ合わせをドキュメントで管理することが、間違いやすく導通確認に時間がかかるようになってきています。  
弊社は、もともと開発が専門なので、こういう類のものは、 IaC (Infrastructure as Code) で管理する方が性に合ってます。  

Terraform

## github も設定できる

Terraform を使うと、github に team やリポジトリを作ったりすることもできる。

https://blog.ckreal.net/?p=368


