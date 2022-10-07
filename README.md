*品研网pipeline子项目,用于取代传统DevOps.*

<h1>目录</h1>

- [使用说明](#使用说明)
- [计算节点定义格式](#计算节点定义格式)
- [服务定义](#服务定义)


# 使用说明
&emsp;&emsp;按照BO方法组建。pipeline是用来更新目标集群状态的工具。

# 计算节点定义格式
&emsp;&emsp;计算节点是一个集群目录`pvdev/nodes/{CLUSTER-NAME}`中的`node.json`文件，用于定义计算节点。其格式如下：

```javascript
{
  name: { //名称允许服务索引节点。
    mode: 'string', //local,ssh,aliyun,tencent,aws
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
&emsp;&emsp;定义服务如何在集群中运行。

```javascript
{
  name: { //name是固定的，目前只支持base,pg,redis,elastic,vault,keycloak,pinyan
    version: '', //可选，选定版本。
    nodes: [], //指明运行的节点。
    /*其它属性由服务自行规定。
    pg:(括号内为默认值)
    username:(app)
    password:(crypto,save to config/postgre/app.passwd)
    database:(app)
    port:(5432)


    */
  }
}
```
