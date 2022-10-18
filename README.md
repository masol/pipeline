*品研网pipeline子项目,用于取代传统DevOps.*

<h1>目录</h1>

- [使用说明](#使用说明)
- [定义文件](#定义文件)
  - [计算节点](#计算节点)
  - [服务定义](#服务定义)
  - [安全性说明](#安全性说明)
- [测试说明](#测试说明)


# 使用说明
&emsp;&emsp;按照BO方法组建。pipeline是用来更新目标集群状态的工具。目前只支持小于200台的集群。采用salt masterless来部署环境。使用上并不需要知道这些细节，只需明白软件生命周期的几个状态，pipeline就是维护这些状态的，并尝试自行补齐人未给出的设定细节。

&emsp;&emsp;为什么在pipeline工具基础上，构建一个新的Pipeline?不仅仅为了支持NoOps，更重要的是为了结合AI，获取项目信息，并由AI设计细节，更新回配置文件并使得Pipeline可以工作，这对新手更友好，并对老手更方便。当前的实现只是留下接口，并未实现AI相关功能(只有几条基于逻辑的弱智规则)，我们会在开发环节的功能就绪后，回头支持这一功能。

# 定义文件

## 计算节点
&emsp;&emsp;计算节点由集群目录`pvdev/nodes/{CLUSTER-NAME}`中的`manual.json`及`auto.json`文件合并定义。两者格式相同，auto是自动版本，而definition为手动版本,其格式如下：

```javascript
{ //以美元符号开头的名称为系统名称。
  $groupXXX: { //增加一组自动部署的节点。暂未支持。
    driver: 'vagrant',// vagrant,aliyun,tencent,aws
    prefix: '', //名称前缀，后续索引节点可以用prefix${i}的格式，i为0基索引。不带i为全部自动节点。
  },
  $oss: { //如果未指定$oss节点，也没有明确指定false。则会在节点上安装cloudserver。并添加$oss伪计算节点。
  },
  name: { //名称允许服务索引节点。可用配置参考[ssh2-promise](https://github.com/sanketbajoria/ssh2-promise)的配置。不能以`_`开头。
    type: 'string', //local,ssh: 指示如何连接到此节点。
    host: '', //给出ipv4或v6地址或domain。
    port: 22, //默认22
    hop: [], //名称序列，指明登录所需的hop。
    services: [], //值为字符串或对象。对象为一个service定义,值为$srvs中的一个服务定义。空值表示自动分配。
    username: '', // 用户名
    readyTimeout: 20000, //建立链接的超时设置。默认20s。
    password: '', //(opt)密码
    rootpwd: '', //如果提供的用户名不是root,需要提供切换进入root的密码。如果未提供，默认可以直接切换。
    key: 'xxx.key' //(opt,但是和密码必须提供一个)支持证书登录。索引的文件位于secret目录中。
  },
  //这里的services是多个节点共享的service定义。了未来会引入自动配置(设计工作),并写回定义文件。
  $srvs: { 
    name: { //name是固定的，目前只支持base,pg,redis,elastic,vault,keycloak,$webapi。$webass(只有在oss不存在时，部署为$webapi的静态资源)。$webwx,$webmb,$webapp(桌面应用),$webtv等资源不属于节点，而是部署为外部服务(类似oss)。
      name: '', //可选，如果在node中直接定义，需要给出名称。如果与外部名称冲突，这一属性拥有高优先级。
      version: '', //可选，选定版本。
      type: 'master|slave', // 默认为全master模式。
      pillar: {}, //如果给定，则做为salt pillar的基础来配置。
      /*其它属性由服务自行规定。
      pg:(括号内为默认值)
      username:(app)
      password:(crypto,save to config/postgres/app.passwd)
      database:(app)
      port:(5432)
      */
      /**cloudserver的定义(后方是默认值)
       * accessKeyId: 'lifecycleKey1',
       * secretAccessKey: 'lifecycleSecretKey1',
       * endpoint: 'localhost:8000',
       * region: 'us-east-1',
       * sslEnabled: false,
       * s3ForcePathStyle: true
      * 
      **/
    }
  }
}
```

## 服务定义
&emsp;&emsp;定义服务如何在集群中运行。位于文件`services.json`中。之所以将services独立出来，而不是放在node下定义。是为了未来引入自动配置(设计工作)。将服务分配于节点的细节隐藏起来，通过执行`gulp`中获取分配结果。

```javascript
{
  name: { //name是固定的，目前只支持base,pg,redis,elastic,vault,keycloak,$webapi,$webass || $webwx,$webmb,$webapp(桌面应用),$webtv
  }
}
```

## 安全性说明
&emsp;&emsp;定义文件中索引到的密码部分,可以使用`$vault:XXXX`格式。其中`XXXX`是key，索引`secret`目录下`secret.json`文件中的值。文件类的值，索引的也是相同目录。不要把生产环境的secret加入到git中。未来支持:vault可以采用vault类服务。

# 测试说明
&emsp;&emsp;使用[vagrantup](https://www.vagrantup.com/)来管理[virtualbox](https://www.virtualbox.org/)。以测试多节点。进入`test`目录对应的子目录下，执行`vagrant up`来启动对应的集群，然后测试pipeline,最后执行`vagrant destroy`来销毁。

&emsp;&emsp;可以自行搜索[vagrant box](https://app.vagrantup.com/boxes/search)来替换镜像。修改现有test来构建新test。

&emsp;&emsp;将对应子测试下的nodes目录拷贝到主项目的nodes下`XXX`子目录下。主项目下执行`gulp status|deploy`等pipeline指令来测试。
