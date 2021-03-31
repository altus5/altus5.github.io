---
layout: app/_layouts/post.html.ejs
title:  "Hyper-VとVirtualBoxのうまい付き合い方"
date:   2019-04-29 10:00:00 +0900
categories: blog docker
description: "Windows で Docker も使いたいし Vagrant も使いたいけど Hyper-V 有効にすると VitualBox が使えない！それでもうまく付き合う共存させる方法を紹介します。"
tags:
  - "環境構築"
  - "Docker"
  - "Vagrant"
  - "Hyper-V"
  - "VitualBox"
---

Windows で Docker も使いたいし Vagrant も使いたいけど Hyper-V 有効にすると VitualBox が使えない！  

いまのところは、どうしようもないので、Hyper-Vを使いたいときだけHyper-Vを有効にして、VirtualBoxを使いたいときには、Hyper-Vを無効にするしかないようです。  

### 限定的だが共存方法がある・・・かも

私の場合、Hyper-Vの使い道は、Docker（Toolboxじゃない方）を使うときで、VitualBox は、Vagrantで開発するときです。
Vagrant が --provider=hyperv で実行できれば良いんですが、特に古いシステムの box は、Hyper-V用のboxが無かったりするので、
いままでは、Hyper-Vの有効無効を切り替えながら使っていました。（※[Hyper-Vのモード切り替え](#Hyper-Vのモード切り替え)参照）

でも、上記の「使い方に限定」するなら、うまく共存させた使い方がありそうだな・・・と思いついて試してみました。

* Hyper-V は有効にしておく
* VagrantのVitualBoxのboxイメージをHyper-V用に変換して使う


mkdir box
mkdir "box\Virtual Hard Disks"
mkdir "box\Virtual Machines"

set vmdk=C:\Users\msato\.vagrant.d\boxes\geerlingguy-VAGRANTSLASH-centos7\1.2.15\virtualbox\packer-centos-7-x86_64-disk001.vmdk

set vhd=packer-centos-7-x86_64-disk001.vhd

set vbox="C:\Program Files\Oracle\VirtualBox\VBoxManage.exe"

%vbox% clonehd %vmdk% %vhd% --format vhd

cd zzz
tar cvfz package-hyper-v.box *
vagrant box add test-box package-hyper-v.box

http://www.hurryupandwait.io/blog/creating-a-hyper-v-vagrant-box-from-a-virtualbox-vmdk-or-vdi-image


<a name="Hyper-Vのモード切り替え"></a>
**:coffee: Hyper-Vのモード切り替え**

> Hyper-Vの有効無効の切り替えは、Hyper-Vをインストールしておいて、bcdeditコマンドでWindowsの起動設定だけを切り替えるのが、一番手間が小さいと思います。
> 
> コマンドプロンプトを**管理者権限**で起動します。
> 
> * Hyper-V 有効
>     ```
>     bcdedit /set hypervisorlaunchtype auto
>     ```
> * Hyper-V 無効
>     ```
>     bcdedit /set hypervisorlaunchtype off
>     ```
> * Hyper-V 現在の状態
>     bcdedit /enum | find "hypervisorlaunchtype"
>
> 設定を変更したら、**再起動が必須**です。





### WSL 2 使いたい

もうすぐ、 WSL 2 が正式にリリースされたら、Windowsのubuntuからも、Dockerが使えるようになるので、Hyper-Vを常に有効にしておきたいですよね。

