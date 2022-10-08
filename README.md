*品研网pipeline子项目,用于取代传统DevOps.*

<h1>目录</h1>

- [使用说明](#使用说明)
- [计算节点定义格式](#计算节点定义格式)
- [服务定义](#服务定义)


# 使用说明
&emsp;&emsp;按照BO方法组建。pipeline是用来更新目标集群状态的工具。

# 计算节点定义格式
&emsp;&emsp;计算节点是一个集群目录`pvdev/nodes/{CLUSTER-NAME}`中的`nodes.json`文件，用于定义计算节点。其格式如下：

```javascript
{ //以美元符号开头的名称为系统名称。
  $driver: 'auto', //auto,salt,ansible,fabric,docker : 安装工具。默认本地为docker,其它环境为salt.如果未指定salt服务，则目标环境为masterless salt来部署。
  $groupXXX: { //增加一组自动部署的节点。暂未支持。
    driver: 'vagrant',// vagrant,aliyun,tencent
    prefix: '', //名称前缀，后续索引节点可以用prefix${i}的格式，i为0基索引。不带i为全部自动节点。
  },
  name: { //名称允许服务索引节点。
    type: 'string', //local,ssh,aliyun,tencent,aws
    ipv4: '', //给出ipv4地址。
    ipv6: '', //暂未实现。
    hop: [], //名称序列，指明登录所需的hop。
    username: '', // 用户名
    password: '', //(opt)密码
    cert: 'xxx.key' //(opt,但是和密码必须提供一个)支持证书登录。索引的文件位于secret目录中。
  }
}
```

# 服务定义
&emsp;&emsp;定义服务如何在集群中运行。位于文件`services.json`中。

```javascript
{
  name: { //name是固定的，目前只支持base,pg,redis,elastic,vault,keycloak,pinyan
    version: '', //可选，选定版本。
    nodes: [], //指明运行的节点。字符串可以指定某一个，或者$auto来自动分配。也可以是一个数字，表明运行于几台服务器。
    /*其它属性由服务自行规定。
    pg:(括号内为默认值)
    username:(app)
    password:(crypto,save to config/postgres/app.passwd)
    database:(app)
    port:(5432)
    */
  }
}
```
