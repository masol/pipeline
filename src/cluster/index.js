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

const SrvFactory = require('./srv')
const NodeFactory = require('./node')

// Dev上需要忽略的服务。
const IgDevSrvs = ['$webapi', '$webass', '$webwx', '$webmb', '$webapp', '$webtv']

const CloudServer = 'cloudserver'
const defSrvs = ['postgres', 'redis', 'elastic', '$webapi']
// 可部署的已知服务
const knowSrvs = ['vault', 'keycloak']

class Cluster {
  #nodes
  #srvDef
  #ossDef
  #dirty // 是否发生了自动分配，从而需要写回原始的节点定义。
  constructor (envs) {
    this.envs = envs
    this.#nodes = {}
    this.#srvDef = {}
    this.#ossDef = null
    this.#dirty = false
  }

  srvDef (name) {
    return this.#srvDef[name]
  }

  assignSrv (node, srvName, srv, _) {
    // 本地环境下忽略$webapi及$webass服务。
    if (node.type === 'local' && IgDevSrvs.indexOf(srvName) >= 0) {
      return
    }
    // 不能将除webass外的服务分配到oss上。
    if (node.type === 'oss' && srvName !== '$webass') {
      return
    }
    // 不能将webass分配到非oss节点上。
    if (node.type !== 'oss' && srvName === '$webass') {
      return
    }
    node.srvs = node.srvs || {}
    node.srvs[srvName] = _.clone(srv)
  }

  /**
   * 将一个srv分配给nodes.
   * @param {Nodes} nodes
   * @param {String} srvName
   * @param {Service} srv
   */
  async #allocSrv (nodes, srvName, srv) {
    const { _ } = this.envs.soa
    const nodeCount = _.keys(nodes).length
    srv.nodes = srv.nodes || []
    // console.log('srv.nodes=', srv.nodes)
    if (srv.nodes.length === 0) { // 自动分配。
      if (nodeCount <= 5) { // 服务运行于全部节点。
        for (const name in nodes) {
          this.assignSrv(nodes[name], srvName, srv, _)
        }
      } else {
        // 尚未实现超过5个的服务分配。
        throw new Error('超过5节点的服务自动分配尚未支持。')
      }
    } else {
      for (const name of srv.nodes) {
        this.assignSrv(nodes[name], srvName, srv, _)
      }
    }
  }

  #initSrvs () {
    const that = this
    const { _ } = that.envs.soa
    const util = that.envs.config.util
    const ossNode = _.find(that.#nodes, (n) => n.type === 'oss')
    if (!ossNode) {
      // @TODO: 是否添加oss node?以方便后续部署。
      console.log('未发现ossNode,添加cloudserver服务依赖。')
      defSrvs.push(CloudServer)
    }

    // 检查服务定义是否已经设置，如未设置，设置为default.
    // 如果服务未启用，但是节点定义中定义了此服务。安全忽略。
    for (let i = 0; i < defSrvs.length; i++) {
      const srvName = defSrvs[i]
      if (!that.#srvDef[srvName] && !util.isDisabled(srvName)) {
        that.#srvDef[srvName] = {}
      }
    }
    for (let i = 0; i < knowSrvs.length; i++) {
      const srvName = knowSrvs[i]
      if (!that.#srvDef[srvName] && util.isEnabled(srvName)) {
        that.#srvDef[srvName] = {}
      }
    }

    for (const nodeName in that.#nodes) {
      const node = that.#nodes[nodeName]
      console.log('node = ', node)
      node.initSrvs()
    }

    // noAllocSrv保存了没有分配节点的服务。
    const noAllocSrv = []
    for (const srvName in that.#srvDef) {
      console.log('srvName=', srvName)
      if (!_.find(that.#nodes, (n) => n.srv(srvName))) {
        noAllocSrv.push(srvName)
      }
    }

    for (const srvName in noAllocSrv) {
      SrvFactory.alloc(that, srvName, that.srvDef(srvName))
    }

    // 未定义ossDef.
    if (!that.#ossDef) {
      const node = _.find(that.#nodes, (n) => n.srv(CloudServer))
      if (node) {
        that.#ossDef = {
          type: 'local'
        }
      }
    }
  }

  async #procInternal (keyName, keyValue) {
    switch (keyName) {
      case '$services':
        this.$srvDef = this.envs.soa._.merge(this.$srvDef, keyValue)
        break
      case '$oss':
        this.#ossDef = keyValue
        break
      default:
        throw new Error(`不被支持的值${keyName}`)
    }
  }

  async init (definition) {
    // 在init中调用service alloc.
    this.definition = definition
    const that = this
    const { _ } = that.envs.soa

    console.log('that.definition=', that.definition)

    // 加载cluster的全部服务及节点。
    for (const keyName in that.definition) {
      if (keyName.startsWith('$')) {
        await that.#procInternal(keyName, that.definition[keyName])
      } else {
        that.#nodes[keyName] = NodeFactory.create(keyName, that.definition[keyName], that)
      }
      console.log('nodeName=', keyName)
    }

    // 如果没有任意节点，并且是dev环境，加入默认节点local。
    if (that.envs.args.target === 'dev' && !_.find(that.#nodes, o => o.type === 'local')) {
      that.#nodes.local = NodeFactory.create('local', {
        type: 'local'
      }, that)
    }

    // 到这里才展开全部服务。因此$service属性位置不关键。
    that.#initSrvs()

    if (_.isEmpty(that.#nodes)) {
      throw new TypeError(`目标集群${that.envs.args.target}未指定任意可计算节点(本地计算机只属于dev集群)。`)
    }

    console.log(this)
  }

  async finish (node) {
  }
}

module.exports = Cluster
