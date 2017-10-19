---
layout: app/_layouts/post.html.ejs
title:  "Web Performerが出力したコードをSpring Boot化してみた"
date:   2017-10-19 10:00:00 +0900
categories: blog webperformer spring
description: "Web Performerで出力されたコードは、Spring 4 に対応していますが、Spring Bootではありません。Spring Boot化する方法をご紹介します。"
tags:
  - "Web Performer"
  - "Spring Boot"
---

## Web Performer とは

Web Performer（以降WP）とは、超高速開発というジャンルに分類されている、
システムを自動生成するツールで、キヤノンITソリューションズさんが開発されています。  
弊社では、このツールを使って、システム開発のスピードアップにトライしています。  
超高速開発と言われているツールには、他にも、GeneXus や、Wagby などがあります。  
WP と GeneXus については、説明会に参加させていただき、Wagby については、
評価版を利用してみて、最終的に、WP を利用することにしました。  

この3つのツールに共通しているのは、確かに自動生成してくれるのだけど、
すべての要件を100%自動生成できるわけではないということ。  
やはり、複雑な処理は、追加で実装したり、外部に補助システムを構築したりして、100%じゃない部分を補完する必要があります。  
自動生成して、時間を圧縮しても、この機能拡張の開発にもたついてしまうと、
せっかくのアドバンテージが無くなってしまうので、機能補完というか、機能拡張のやり方に、
それぞれのツールを有効活用するコツがあるように思います。

WPの場合は、拡張機能部分は、追加実装していく方式です。  
自動生成されたコードは、修正しないで、機能拡張用のクラスを追加実装していきます。  
その開発方法も、開発ガイドに準備されていて、わからない場合は、
サポートサイトが用意されているので、Googleで検索する代わりに、
そこに問い合わせをして、解決策を得る感じになります。  
弊社が Web Performer を選択した理由の1つは、このサポートが手厚そうなところでした。  

## Spring Boot化

さて、WPを使った開発の中で、私たちで工夫してきたことが、いくつかあるので、ご紹介します。  
記事タイトルにもしましたが、WPが生成したコードを Spring Boot 化する方法になります。

WPで出力されたコードは、Spring 4 に対応していますが、 Spring Boot ではありません。  
弊社は、WPを使った開発もやっているけれど、スクラッチでの開発の方が、
開発機会としては多くて、Spring を使った開発だと、最近では、Spring Boot です。  

弊社流のWPを活用した開発は、WPで典型的な実装を自動生成して、複雑なロジックの実装は、Spring Boot で実装するというやり方を採っています。
特にスクラッチの開発に慣れた人には、合ってるように思います。

※ここで紹介するやり方は、キヤノンITソリューションズさんでは、推奨していませんし、サポート対象外になると思うので、自己責任の元、行ってください。

### mavenプロジェクトにする

WPを使うと、クラスのコンパイルまでやってくれるし、依存 jar なども、
自動的に配備してくれるので、mavenを使う必要はないのだけど、
Spring Boot化するには、mavenか、gradle プロジェクトにする必要があります。  
弊社では、mavenプロジェクトにしました。

mavenを使うメリットは他にもあります。
WPは、インストールベースでライセンスが発生しますが、出力されたコードを使う分には、ライセンスが発生しません。  
機能拡張の部分は、普通にJavaのクラスで実装するので、WPが無くても開発できます。
極端な話、WPでコード生成する作業を1台のPCで行って、生成されたコードをソース管理のリポジトリにコミットして、共有しておけば、他のPCでは、共有されたコードを使って、WPなしで機能拡張部分を開発することができます。  
WPのインストールが不要なら、その分のライセンスも節約できます。

以下に pom.xml を作成する場合のポイントを整理してみましたので、参考にしてください。

#### プロジェクトの構成を分割する
弊社では、4つのプロジェクトに分けました
1. 以下のプロジェクトのまとめ役としての親POMプロジェクト
2. WPが生成するjspやWEB-INF配下とSpring Bootの構成ファイルをパッケージしたメインのwarプロジェクト
3. WPが生成するjavaソースコードをまとめた jarプロジェクト
4. 機能拡張部分の jarプロジェクト

上記の2と3は、1つでも良いのですが、4から3の中にある機能を利用する可能性を考慮するなら、分けておくと良いと思います。

#### WPが依存するjarを洗い出す
WPが利用しているjarを洗い出して、pom.xmlに追加します。

##### jarをリストアップ  
WPでアプリケーションを生成したら、出力されたディレクトリにある、WEB-INF/lib の中にある jar をリストアップします。  

##### pom.xml の dependency に追加
jarファイル名と、ファイル名にあるバージョン番号を手掛かりに、mvnrepositoryで検索して、pom.xml の dependency に追加します。

##### 詳細がわからないjarの対応  
jarファイル名だけでは、バージョン番号がわからないとか、mvnrepositoryで検索しても、見つからない jarがあったりします。もとより面倒ということもあります。  
弊社では、groupIdを独自のものにして、mvnのローカルリポジトリに追加することで対応しました。可能なら、nexusなどのプライベートリポジトリを使った方がよいと思います。  
例を示します。  
commons-validator.jarというファイル名だけでは、バージョンがわかりません。ファイルサイズを手掛かりに、mvnrepositoryで検索すると、versionは、1.4であることがわかったのですが、それ自体面倒です。
* 本来の正しい dependency
~~~xml
<dependency>
  <groupId>jakarta-regexp</groupId>
  <artifactId>commons-validator</artifactId>
  <version>1.4</version>
</dependency>
~~~
* 独自の dependency を作ってローカルリポジトリに登録してしまう
~~~xml
<dependency>
  <groupId>jp.altus5.webperformer</groupId>
  <artifactId>commons-validator</artifactId>
  <version>2.1.1</version>
</dependency>
~~~
groupIdを jp.altus5.webperformer と他とは被らないものにして、versionは、WPのバージョンにしておくとよいと思います。  
このままでは、jarが見つかりませんので、mvnコマンドで、ローカルリポジトリに追加します。
~~~bash
mvn install:install-file \
  -Dfile=$webapp/WEB-INF/lib/commons-validator.jar \
  -DgroupId=jp.altus5.webperformer \
  -DartifactId=commons-validator \
  -Dversion=2.1.1 \
  -Dpackaging=jar \
  -DgeneratePom=true \
  -DcreateChecksum=true
~~~

##### Servletのバージョンを3.0にあわせる  
Spring Bootのデフォルトのtomcatは、Servlet 3.0なので、3.0未満に依存した jarから、servlet-api を除外します。WP2.1.1では、axis2-jaxwsと、axis2-kernel、axis2-springの3つです。  
~~~xml
<dependency>
  <groupId>org.apache.axis2</groupId>
  <artifactId>axis2-jaxws</artifactId>
  <exclusions>
    <exclusion>
      <groupId>javax.servlet</groupId>
      <artifactId>servlet-api</artifactId>
    </exclusion>
  </exclusions>
</dependency>
~~~
これは、Spring Boot化したら、WPの機能のうち、SOAPを使った機能が使えないかもしれないことを示唆しています。弊社では、SOAPを使わないので、その動作確認もしていませんが、もし、使いたい場合には、spring-boot-legacy の利用を検討するとよいと思います。
    
##### Spring Bootのプラグインや依存jarを追加する
~~~xml
<dependency>
  <groupId>org.springframework.boot</groupId>
  <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<!-- Spring BootでJSPを使えるようにする -->
<dependency>
  <groupId>org.apache.tomcat.embed</groupId>
  <artifactId>tomcat-embed-jasper</artifactId>
  <scope>provided</scope>
</dependency>
~~~

##### Spring Bootを実行可能warとなるように設定する
Spring Bootは、実行可能なjarとしてビルドすることができますが、
WPが生成するコードは、jspが使われていて、Spring Bootでjspを使うには、
jarでは、無理で、warにビルドする必要があります。  
こちらも、実行可能なwarとしてビルドできます。

##### jspやプロパティの文字コードをUTF-8に整える
この作業は無くても大丈夫ですが、一部のコードは、Windows-31jを文字コードとしたものが出力されます。  
機能拡張の実装をするときに、WP以外の Eclipse や エディタでそのリソースを開くと文字化けして見辛いので、いっそ、文字コード変換をしておくとよいかもしれません。  
弊社では、文字コード変換のための gulpタスクを作成して、nodejsで変換しています。

##### 自動ビルドとnexusの利用
WP上で編集した各種定義ファイルを、リポジトリにプッシュしたら、コード生成からコンパイル、jar作成までを、自動ビルドするスクリプトがあると便利です。  
特に、大きいプロジェクトになってくると、コンパイルに時間がかかるようになるので、メモリをたっぷり割り当てて、ビルド時間の最小化を試みるのもよいと思います。  
弊社では、ビルドサーバーを設けて、WPのソースをプッシュしたら、ビルドサーバでビルドして、jarファイルをnexusのプライベートリポジトリにコミットして、
拡張機能の担当者に自動配布されるようにしています。

### Spring Boot のコンフィグレーション
Spring Boot として実行するための main と、コンフィグレーションを実装します。
コンフィグレーションの内容は、WPが出力した web.xml をもとにします。

#### mainクラス
~~~java
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}
~~~

### Web関連以外のコンフィグレーション
~~~java
@Configuration
@ComponentScan(basePackages = {"jp.altus5.hoge", "jp.co.canon_soft.wp.runtime.webmvc.component"})
@EnableAutoConfiguration
public class AppConfig {
}
~~~
DBの構成なども、ここに追加して良いと思います。
弊社では、バッチ処理からもDBの構成を利用したいので、拡張ライブラリの方に、追加しました。

### Web関連のコンフィグレーション
~~~java
@Configuration
public class WebConfig extends WebMvcConfigurerAdapter {
    @Bean(name = DispatcherServletAutoConfiguration.DEFAULT_DISPATCHER_SERVLET_BEAN_NAME)
    public DispatcherServlet dispatcherServlet() {
        return new DispatcherServlet();
    }

    @Bean(name = DispatcherServletAutoConfiguration.DEFAULT_DISPATCHER_SERVLET_REGISTRATION_BEAN_NAME)
    public ServletRegistrationBean dispatcherServletRegistration() {
        ServletRegistrationBean registration = new ServletRegistrationBean(
                dispatcherServlet(), new String[]{"*.do"});
        registration
                .setName(DispatcherServletAutoConfiguration.DEFAULT_DISPATCHER_SERVLET_BEAN_NAME);

        return registration;
    }

    @Bean
    public ViewResolver setupViewResolver() {
        UrlBasedViewResolver resolver = new UrlBasedViewResolver();
        resolver.setViewClass(JstlView.class);
        return resolver;
    }

    @Override
    public void configureDefaultServletHandling(DefaultServletHandlerConfigurer configurer) {
        configurer.enable();
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addWebRequestInterceptor(new RequestInterceptor());
    }

    ・・・・
~~~

WPが出力したコードの所有権とか著作権は、弊社が保有するものの、WP自体はOSSではないので、
どこまで、コードを公開してよいのか、判断できないため、一部を抜粋して、掲載しています。

## まとめ

以上、WPが出力したコードをSpring Boot化するポイントをご紹介しました。  
もし、ご興味のある方がいらっしゃいましたら、お気軽にお問い合わせください。
