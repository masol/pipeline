/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 15 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

const Base = require('./base')

// 计算节点上需要忽略的服务。(通过集群的非标部署,例如cluster.$oss来部署$webass)
const IgnoreSrvs = ['$webass', '$webwx', '$webmb', '$webapp', '$webtv']

const CloudServer = 'cloudserver'
const Redis = 'redis'
const DefSrvs = ['postgres', 'redis', 'elastic', '$webapi']
// 可部署的已知服务
const KnowSrvs = ['vault', 'keycloak']

function create (name, srvDef, node) {
  return new Base(name, srvDef, node)
}

// 将指定srvDef分配到cluster中(假定这些srv未分配)。
function alloc (cluster, name, srvDef) {
  const { _ } = cluster.envs.soa
  if (IgnoreSrvs.indexOf(name) >= 0) { // 忽略忽略节点
    return
  }

  if (_.find(cluster.nodes, (n) => n.srv(name))) { // 已经定义了此服务。忽略之。
    return
  }

  if (name === '$webapi' && cluster.envs.args.target === 'dev') {
    // 本地环境下，不部署$webapi.
    return
  }

  const nodes = _.values(cluster.nodes)
  const noHopFilter = (n) => n.hop.length === 0
  const noHopNodes = _.filter(nodes, noHopFilter)
  const nodeCount = nodes.length
  if (name === CloudServer) {
    // 寻找一个无hop节点，并部署。
    const nohopSrvOrder = _.sortBy(noHopNodes, (n) => n.srvCount())
    const csNode = nohopSrvOrder.length > 0 ? nohopSrvOrder[0] : null
    if (!csNode) {
      throw new Error(`无法分配${CloudServer}服务，所有节点不可直连。`)
    }
    csNode.addSrv(name, srvDef)
  } else { // 为所有节点添加此服务。
    if (nodeCount <= 5) {
      if (name === Redis) { // redis只配置两台服务。
        const nodeSrvOrder = _.sortBy(nodes, (n) => n.srvCount())
        let master, slave
        for (let i = 0; i < nodeSrvOrder.length; i++) {
          const n = nodeSrvOrder[i]
          if (n.hop.length === 0) {
            if (!master) {
              master = n
            } else if (!slave) {
              slave = n
            }
          } else if (!slave) { // 有hop的主机，可以分配给slave.
            slave = n
          }
          if (master && slave) {
            break
          }
        }
        if (master) {
          const def = _.clone(srvDef)
          def.type = 'master'
          master.addSrv(name, def)
        }
        if (slave) {
          const def = _.clone(srvDef)
          def.type = 'slave'
          slave.addSrv(name, def)
        }
      } else {
        _.forEach(nodes, n => {
          if (!n.addSrv(name, srvDef)) {
            throw new Error(`无法为节点${n.name}加入服务${name},已经存在？`)
          }
        })
      }
    } else {
      throw new Error('超过5节点的服务自动分配尚未支持。')
    }
  }
}

module.exports.create = create
module.exports.alloc = alloc
module.exports.consts = {
  CloudServer,
  DefSrvs,
  KnowSrvs
}
