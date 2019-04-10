---
layout: app/_layouts/post.html.ejs
title:  "Angularのエラー処理について考える（設計編）"
date:   2019-03-30 15:00:00 +0900
categories: blog angular
description: "Angularを例にしてSPAでシステムを構築するときに考慮すべきエラー処理について整理してみました"
tags:
- "Angular"
- "エラー処理"
- "SPA"
---

システムの開発をしていると、約30%は、エラー処理の対策になると聞いたことがあります。  
30%という数字は、根拠がないので置いとくとして、システムを構築する上で、エラーに対処することは、
非常に重要な設計要素であることは、間違いありません。  

本記事は、私がAngularの開発を通じてエラー処理について、考えたことを整理してみました。
尚、モバイルアプリなども含めると、いろいろ複雑になるので、デスクトップ利用に限定された、業務システムということで、検討範囲を絞り込んでいます。

## エラー処理設計の目的

エラー処理を設計するにあたり、検討しておきたいことを挙げてみました。

* 発生し得るすべてのエラーを明らかにする
* エラー発生時の振る舞いが統一されている
* 各画面への重複した設計記述および実装を減らす
* 漏れなく穴をふさぐ

このあたりは、Angular(SPA)だからというよりも、システムとして共通の目的ですね。

## エラー分類

プロジェクトの開始時点では、すべてのエラーを洗い出すことが難しいかもしれないので、典型的なエラーとして分類するところから始めます。  
そして、画面の設計、実装過程で、見つかったエラーを、この分類に当てはめて、具体的な仕様として定義していくのが、良いかと思います。  
この分類にハマらないものが出てきたら、その都度検討して、新しい分類を追加していくことにします。

### (エラー分類1) 致命的エラー
システムが動作する前提となるハードウェアあるいはミドルウェアが異常な状態を示すエラー。

* **1-1 localStorageのエラー**
    ログイン状態の保持などに、localStorageを使用する場合があり、CookieをOffにしている場合や、一部ブラウザのプライベートモードの場合にエラーになることがある。
* **1-2 メンテナンス中**
    APIサーバーがメンテナンス中の状態。

APIサーバーに接続できないときのエラーとかは、ここに分類されてもよいかもしれませんが、瞬間的なネットワーク断は、特にモバイルアプリなどでは、よくあることで、致命的ではないため、ここには分類しませんでした。

> :sun_with_face: **エラー時の振る舞い例**  
> ２つくらい考えられると思います。
> * ログイン画面を表示してエラーメッセージとして、エラー原因を表示する
> * システムエラーの500画面、あるいはメンテナンス中の503画面を表示して、同じくエラー原因を表示する
> 
> どちらにしても、エラー原因をメッセージとして表示することで、利用者が次のアクションが取れるようにしておくと良いでしょう。

### (エラー分類2) 業務継続不可能なエラー
利用する機能の前提要件を満たしていなくて、業務が行えないエラー。

* **2-1 未認証**
    ログインしないで、業務画面（URL）にアクセスがあった場合。
* **2-2 権限不一致**
    アクセス権限のない、業務画面（URL）にアクセスがあった場合
* **2-3 セキュリティ保護**
    XSRF、不正操作、認証時間のタイムアウトなど、セキュリティ保護策によるエラー
* **2-4 バグ**
    バグによって想定外の状態になった場合

> :sun_with_face: **エラー時の振る舞い例**  
> 未認証の場合は、ログイン画面にリダイレクトされるのが、よくある仕様だと思います。  
> 権限不一致とセキュリティ保護は、403画面を表示して不正操作のヒントを与えないのが良いと思います。
> バグも、2次被害の恐れがあるので、500画面を表示して続く操作が出来ないようにするのが良いでしょう。

### (エラー分類3) 業務継続可能なエラー
発生したエラーは、エラーを除去（解除）することで、業務が継続できるエラー。

* **3-1 排他制御エラー**
    複数端末で同一データに同時更新があった場合のエラー。
* **3-2 ユニーク制約エラー**
    同一データ（同一キー）が同時に登録された場合のエラー。
* **3-3 データが存在しないエラー**
    存在するハズのデータが無かった場合のエラー。
    例えば、一覧で選択して詳細ページに遷移するようなケースで、選択したデータが、他の端末で一瞬早く削除された場合など。
* **3-4 バリデーションエラー**
    入力値のエラー。
    入力値を修正することで、業務継続が可能。
* **3-5 通信タイムアウト**
    タイムアウトが発生して、期待するデータの取得あるいは、更新ができなかった状態。
* **3-6 サーバー接続不能**
    APIサーバーに接続できない状態。  
    クライアント側でネットワーク障害があった場合などが想定されます。  
    特に、モバイルアプリの場合は、ネットワーク断の状態は、日常的に発生するエラーなので、リトライ処理で自動回復させる仕組みを用意することもあると思います。  
    担当したプロジェクトは、デスクトップアプリに限定されていたので、APIサーバーに接続できないときのリトライは行わずに、ユーザーの再操作を期待するUIにしました。
* **3-7 画面機能固有のエラー**
    画面機能によるので、個別画面の仕様として規定する。

> :sun_with_face: **エラー時の振る舞い例**  
> 排他制御エラーとユニーク制約エラーは、操作画面上にエラーメッセージを表示して、やり直しが出来るようにします。
> バリデーションも同じです。再入力するためのガイダンスを表示します。
> 通信タイムアウトについては、システムの特性によります。私が担当したプロジェクトでは、通信がタイムアウトしたことを、Snackbarで表示させて、再操作を即すようなUIにしました。
> 画面機能固有のエラーは、ここでは割愛します。

## エラー発生元と処理方式

エラーが発生する場所としては、次が考えられます。
* Web APIの実行時
* localStorage アクセス時
* バグ
* 機能固有の仕様

それぞれの発生元別に、エラーを整理します。

### API実行時のエラー処理

APIの実行では、2種類のエラーが発生する可能性があります。  
@see <https://angular.jp/guide/http#%E3%82%A8%E3%83%A9%E3%83%BC%E3%83%8F%E3%83%B3%E3%83%89%E3%83%AA%E3%83%B3%E3%82%B0>

* **エラーステータス**
    APIがHTTPのステータスコードでエラーを返す
* **ErrorEvent**
    ネットワークエラーやrxjs過程のバグでErrorEventが発生する

実装としては、http通信に関連したエラー処理はインターセプターで行い、画面個別での対処が必要なエラー(例えばunique制約の発生など)に対しては、例外をthrowすることで画面側に処理を連携する方式としました。  

![](http://www.plantuml.com/plantuml/png/VLHVJnfF57tVJp7ndVZkWz6Otw-QzC54tyI75QT02hDaNMgQneIPGSM0rQhrZwcXAhMe4TeQKwkqVfZRPU5RzEuiR5PMIOnXT-yzvzmpvyx8WgMRLZQTqhIC7dkjnoaP07a8iW7YTe2yqmYPcNJVZXdfZC4eisQr9KrBCekQh_GO9UEMbHbB9V63nWoB4ZCPJrXaY8peB9vDwUPWp4Yd3JQOmBeWXxXnEUGsY5yTcj792J95pJV969t5vqTe2ujwF4xDI9mo0lm2-3dmhyvEkLdO1FuHH0b44Vk1rq3KGPuZglQ4T1A939EP_wbkPKqQ80kzKvKXIS5dLH6SVYamdRtylPqxRCkgNLZfJfUYfXMGqZiXYAghMpPQnrMdSkViL45SWyI_8sNKklfTW9o8CZjNj0jVd9txzj69MyXhFYxQ0hokBDg078yoPTKsy2A8DVUZ43rCgcCT_PjYA7zEDtr_eyml1R7LhJx0KbJnQ5uGFz5na2iWF__zKxGhkxqPcdgxOD7qVwPfc7rD2E7mccUcD-rZLda5uXk82bhJo_VIY2TPFwP0xnFG_k3swfcpkU99SA5TxF7fwKaouMv0Z6Oim-m53wH21LBf4mzAtpt8lSvlNW8krAaKWU-3uCx1VRlqevDdVWOyZ__L8GO1ItQjt3ek-R5lrjy3lxG_8E2rlNhdlmybfNbURidVBcsEFo_g4dZ5OsxcDrfN-zw1sm_BhJFUJLOURGWCII9gMKAsF6sMsflGOWuHJwGwbrkG4WHotQ9_xTnfSnF7mfZleQee6yraL8uw0H5RLi8q5ljmlKWPStgAUE4RrzayhgBBw9rjr-yBTGwdmCi-S9GrF-MS6-4Svj6ORhbQ0BcXGhVcfKGZpx54iXdNdJuB45QjcbHNACQekdMntgesshidQ0pQuoUr7zHm-Fv19BTQNJ8DTn1Uyg7G2HKxbS-YIaFT_wYYS-3THjWKqwrOekjX6UEiEdlOqBtmLU8kt0XbyzbqwXy0)

@see <https://angular.jp/guide/http#%E3%83%AA%E3%82%AF%E3%82%A8%E3%82%B9%E3%83%88%E3%81%A8%E3%83%AC%E3%82%B9%E3%83%9D%E3%83%B3%E3%82%B9%E3%81%AE%E3%82%A4%E3%83%B3%E3%82%BF%E3%83%BC%E3%82%BB%E3%83%97%E3%83%88>

#### インターセプター内でのhttpステータスコード毎の処理

* **400 Bad Request**  
    パラメータのエラーや、validationエラーなどが想定される。  
    インターセプターからは、独自の例外クラス AppError.BadRequest をthrowする。  
    Page Componentの中では、例外をcatchしてエラー内容を画面に反映する。
* **401 Unauthorized**  
    インターセプター内で、`@angular/router/Router#navigate` にloginのURLをセットして、ログイン画面に遷移する。
* **403 Forbidden**  
    アクセス不可のエラーなので、403画面に遷移する。
* **404 Not Found**  
    詳細画面や編集画面で対象データが存在しない場合などが想定される。  
    インターセプターからは、独自の例外クラス AppError.NotFoundをthrowする。  
    Page Componentの中では、例外をcatchしてエラー内容を画面に反映する。  
    一覧画面で一覧の内容がない場合は、画面内に反映する。  
    詳細画面や編集画面でURL内にIDが含まれる場合は、`@angular/router/Router#navigate` に404画面のURLをセットして、404画面に遷移する。  
    一覧画面の親データ(例えばアカウント一覧の組織自体が無い)が無い場合も同様に404画面に遷移する
* **409 Conflict**  
    データ登録で一意性制約違反や排他エラーが発生した場合などが想定される。  
    インターセプターからは、 AppError.Conflict を throw する。  
    Page Componentの中でcatchしてエラーに対応した処理を実行する。
* **500 Internal Server Error**  
    このエラーは、バグなので、システムエラーの500画面に遷移する。
* **503 Maintenance**  
    このエラーも、メンテナンス中の503画面に遷移する。

※AppError は独自の例外クラスを作成してあるものとします

#### ErrorEvent毎の処理

同じく、インターセプターでのErrorEvent発生時の処理です。

* **タイムアウト**  
    アラートをSnackbarで表示する。
* **接続不能**  
    同じく、Snackbarで表示する。

### localStorage アクセス時のエラー処理

エラー分類1の致命的なエラーの処理を行う。

### バグのエラー処理

バグは、globalエラーハンドラーで処理することとして、画面側では、例外をcatchしない。

### 画面固有のエラー処理

エラーの共通仕様としては、定義しないで、画面あるいは、サービスクラスで実装する。

---

[実装編の記事](https://www.altus5.co.jp/blog/angular/2019/04/10/angular-error-hadling-implement/)も読んでみて下さい。
