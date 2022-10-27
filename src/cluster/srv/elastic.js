/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 22 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: elastic
const Base = require('./base')

class Elastic extends Base {
  async deploy () {
    const that = this
    // const cfgutil = that.node.$env.config.util
    const needDeploy = await super.deploy()
    console.log(that.name, 'needDeploy=', needDeploy)
    if (!that.isSingle()) {
      throw new Error('集群模式Elastic部署，尚未实现。')
    }

    // 查找支持全部$webapi服务的节点。需要从$webapi节点访问数据库，据此判定是本地访问还是remote访问。
    const webApiNodes = that.node.$cluster.nodesBySrv('$webapi')
    const fromLocal = (webApiNodes.length === 1 && webApiNodes[0] === that.node)

    if (needDeploy) {
      await that.node.port(fromLocal ? 'close' : 'open', 6379, Base.nodeIps(webApiNodes))

      await that.node.ensurePkg(that.name)
      that.node.startSrv(that.name)
    }
    // 即使不部署，也需要更新本地local配置，否则会丢失配置。
    const localCfg = that.node.$cluster.srvCfg('elastic')
    localCfg.conf = localCfg.conf || {}
    if (!fromLocal) {
      localCfg.conf.host = that.node.pubIp
    }
  }
}

module.exports = Elastic
