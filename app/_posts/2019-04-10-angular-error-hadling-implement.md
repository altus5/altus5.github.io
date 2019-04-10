---
layout: app/_layouts/post.html.ejs
title:  "Angularのエラー処理について考える（実装編）"
date:   2019-04-10 15:00:00 +0900
categories: blog angular
description: "Angularのエラー処理に関する実装編です"
tags:
- "Angular"
- "エラー処理"
- "SPA"
---

[前回の記事](https://www.altus5.co.jp/blog/angular/2019/03/30/angular-error-hadling-design/)では、Angularのエラー処理について設計時の目線で整理しました。  
今回は、それを実装するときに、どんなことになるのか、実例を添えて説明します。  

## エラー分類と画面側の実装

前回の設計編に記述したエラー分類別に、画面側に実装するエラー処理について、一覧化しました。  
画面固有の機能として実装すべきものか、あるいは、共通処理として実装すべきかについて、区別します。

\#  | エラー                   | 画面側の実装
----|--------------------------|-------------------
1-1 | サーバー接続不能         | なし
1-2 | 通信タイムアウト         | なし
2-1 | 未認証                   | なし
2-2 | 権限不一致               | なし
2-3 | セキュリティ保護         | なし
2-4 | バグ                     | なし
3-1 | 排他制御エラー           | PageコンポーネントでAppErrorをcatchして実装する
3-2 | ユニーク制約違反エラー   | 同上
3-3 | データが存在しないエラー | 同上
3-4 | バリデーションエラー     | 同上
3-5 | 画面機能固有のエラー     | Pageコンポーネントかサービスクラスで実装する

## 共通処理としての実装例

### 例外クラス

まずは、例外クラスを作って、 error を catch したときに、区別できるようにします。

```typescript
export namespace AppError {
  export function isInstance(error: BaseError, clazz) {
    return error.name && error.name === clazz.name;
  }

  export class BaseError extends Error {
    constructor(message?: string, error?: Error) {
      super(message);
      this.name = 'AppError.BaseError';
      this.message = message;
      if (error) {
        this.stack += `\nCaused by: ${error.message}`;
        if (error.stack) {
          this.stack += `\n${error.stack}`;
        }
      }
    }
  }

  export class ApiError extends BaseError {
    private response: HttpResponseBase;

    constructor(message?: string, response?: HttpResponseBase, error?: Error) {
      super(message, error);
      this.name = 'ApiError';
      this.response = response;
    }
  }

  export class BadRequest extends ApiError {
    constructor(message?: string, response?: HttpResponseBase, error?: Error) {
      super(message, response);
      this.name = 'BadRequest';
    }
  }

  export class Unauthorized extends ApiError {
    constructor(message?: string, response?: HttpResponseBase, error?: Error) {
      super(message, response);
      this.name = 'Unauthorized';
    }
  }

  ・・・

  export class ApiErrorFactory {
    public static getError(res: HttpResponseBase): ApiError {
      let error: ApiError = null;
      switch (res.status) {
        case 400:
          error = new AppError.BadRequest(null, res);
          break;
        case 401:
          error = new AppError.Unauthorized(null, res);
          break;
        case 403:
          error = new AppError.Forbidden(null, res);
          break;

        ・・・
      }
      return error;
    }
  }
```
※ `AppError.isInstance`は Typescript の instanceof が意図した結果を返してくれないので、各エラークラス内に、クラス名を保持するようにして、それと一致するかをチェックするためのユーティリティです。  

### インターセプター

http通信のエラーを処理するためのインターセプターです。

```typescript
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private router: Router, private alertService: AppAlertService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    if (req.reportProgress) {
      throw new AppError.BaseError('not implements');
    }
    return next.handle(req).pipe(
      map((event: HttpEvent<any>) => {
        if (event instanceof HttpResponse) {
          const err = this.handleAppError(event);
          if (err) {
            throw err;
          }
        }
        return event;
      }),
      catchError((errRes: HttpErrorResponse) => {
        if (errRes.error instanceof ErrorEvent) {
          const message = `An error occurred: ${errRes.error.message}`;
          this.errorLog(message);
          this.alertService.error(message);
        } else {
          const err = this.handleAppError(errRes);
          if (err) {
            throw err;
          }
        }
        return throwError(errRes);
      })
    );
  }

  private handleAppError(event: HttpResponseBase) {
    const err = AppError.ApiErrorFactory.getError(event);
    if (err === null) {
      return err;
    }
    if (AppError.isInstance(err, AppError.Unauthorized)) {
      this.errorLog(err);
      this.router.navigate(['/login']);
      return null;
    }
    if (AppError.isInstance(err, AppError.Forbidden)) {
      this.errorLog(err);
      this.router.navigate(['/error/403']);
      return null;
    }
    if (AppError.isInstance(err, AppError.ServerError)) {
      this.errorLog(err);
      this.router.navigate(['/error/500']);
      return null;
    }
    if (AppError.isInstance(err, AppError.Maintenance)) {
      this.errorLog(err);
      this.router.navigate(['/error/503']);
      return null;
    }
    return err;
  }

  private errorLog(message: string | Error) {
    if (message instanceof Error) {
      const err = message;
      message = `${err.message}: ${err.stack}`;
    }
    console.error(message);
  }
}
```

### アラート表示用のサービス

タイムアウトなどのErrorEventが発生したときには、特定のコンポーネントに依存しないSnackBarで、アラートメッセージを表示する例です。

```typescript
@Injectable()
export class AppAlertService {
  constructor(private snackBar: MatSnackBar, private zone: NgZone) {}

  error(message: string) {
    this.zone.run(() => {
      const snackBar = this.snackBar.open(message, 'OK', {
        verticalPosition: 'bottom',
        horizontalPosition: 'center',
      });
      snackBar.onAction().subscribe(() => {
        snackBar.dismiss();
      });
    });
  }
}
```

### バグなどのグローバルエラーハンドラー

バグ発生時などの不測のエラーでは、2次被害が出ないように、システムエラーの画面にリダイレクトさせる例です。

```typescript
@Injectable({
  providedIn: 'root',
})
export class AppErrorHandler implements ErrorHandler {
  constructor(private injector: Injector) {}

  handleError(error) {
    this.errorLog(error);
    const router = this.injector.get(Router);
    const zone = this.injector.get(NgZone);
    zone.run(() => {
      router.navigateByUrl('/error/500');
    });
  }

  private errorLog(message: string | Error) {
    if (message instanceof Error) {
      const err = message;
      message = `${err.message}: ${err.stack}`;
    }
    console.error(message);
  }
}
```


## 画面側の実装例

### 排他制御エラー

ページコンポーネントの〇〇更新サービスを実行する箇所で、例外をcatchする例

```typescript
return this.hogeService.update(data).pipe(
  map((result) => {・・・}),
  catchError((err) => {
    if (AppError.isInstance(err, AppError.BadRequest)) {
      this.errorMessage = '他のユーザーによって更新されています。最初からやり直してください';
      return EMPTY;
    } else if (AppError.isInstance(err, AppError.NotFound)) {
      this.errorMessage = '他のユーザーによって削除されています。最初からやり直してください';
      return EMPTY;
    }
    return throwError(err);
  })
);
```

### ユニーク制約違反エラー

ページコンポーネントの〇〇保存サービスを実行する箇所で、例外をcatchする例

```typescript
return this.hogeService.update(data).pipe(
  map((result) => {・・・}),
  catchError((err) => {
    if (AppError.isInstance(err, AppError.Conflict)) {
      this.errorMessage = 'キーが重複しました。最初からやり直してください';
      return EMPTY;
    }
    return throwError(err);
  })
);
```

### データが存在しないエラー

データ存在しないときに、どうするのかは、画面固有の仕様として策定する必要があります。  
よくあるパターンを上げてみます。

* システム例外として、404の画面に遷移する例
    ```typescript
    return this.hogeService.get(data).pipe(
      map((result) => {・・・}),
      catchError((err) => {
        if (AppError.isInstance(err, AppError.NotFound)) {
          this.router.navigate(['/error/404']);
          return EMPTY;
        }
        return throwError(err);
      })
    );
    ```
* データがないときには、別のページに遷移する例（例えば遷移前の画面が一覧画面だったら、その画面にリダイレクトする）
    ```typescript
    return this.hogeService.get(data).pipe(
      map((result) => {・・・}),
      catchError((err) => {
        if (AppError.isInstance(err, AppError.NotFound)) {
          this.router.navigate(['/hoges/list']);
          return EMPTY;
        }
        return throwError(err);
      })
    );
    ```
* データがないときは、エラーメッセージを表示する
    ```typescript
    return this.hogeService.get(data).pipe(
      map((result) => {・・・}),
      catchError((err) => {
        if (AppError.isInstance(err, AppError.NotFound)) {
          this.errorMessage = 'データが存在しません';
          return EMPTY;
        }
        return throwError(err);
      })
    );
    ```

### バリデーションエラー

サーバー側でバリデーションエラーが発生することもあるでしょう。
コンポーネント内のエラーメッセージにセットする例です。
```typescript
return this.hogeService.register(data).pipe(
  map((result) => {・・・}),
  catchError((err) => {
    if (AppError.isInstance(err, AppError.BadRequest)) {
      this.errorMessage = 'XXXXXXXXXXXX';
      return EMPTY;
    }
    return throwError(err);
  })
);
```

