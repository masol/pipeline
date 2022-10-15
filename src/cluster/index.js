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

class Cluster {
  #nodes
  #srvDef
  #ossDef
  #feched // 是否已经获取了系统信息。
  #dirty // 是否发生了自动分配，从而需要写回原始的节点定义。
  constructor (envs) {
    this.envs = envs
    this.#nodes = {}
    this.#srvDef = {}
    this.#ossDef = null
    this.#dirty = false
    this.#feched = false
  }

  get nodes () {
    return this.#nodes
  }

  srvDef (name) {
    return this.#srvDef[name]
  }

  /// 到Cluster获取完基础信息，获取服务状态前，才调用initSrvs,展开全部服务。因此$service属性位置不关键。并且可以访问节点信息。
  initSrvs () {
    const that = this
    const { _ } = that.envs.soa
    const util = that.envs.config.util
    const ossNode = _.find(that.#nodes, (n) => n.type === 'oss')
    if (!ossNode) {
      // console.log('未发现ossNode,添加cloudserver服务依赖。')
      SrvFactory.consts.DefSrvs.push(SrvFactory.consts.CloudServer)
    }

    // 检查服务定义是否已经设置，如未设置，设置为default.
    // 如果服务未启用，但是节点定义中定义了此服务。安全忽略。
    for (let i = 0; i < SrvFactory.consts.DefSrvs.length; i++) {
      const srvName = SrvFactory.consts.DefSrvs[i]
      if (!that.#srvDef[srvName] && !util.isDisabled(srvName)) {
        that.#srvDef[srvName] = {}
      }
    }
    for (let i = 0; i < SrvFactory.consts.KnowSrvs.length; i++) {
      const srvName = SrvFactory.consts.KnowSrvs[i]
      if (!that.#srvDef[srvName] && util.isEnabled(srvName)) {
        that.#srvDef[srvName] = {}
      }
    }

    for (const nodeName in that.#nodes) {
      const node = that.#nodes[nodeName]
      // console.log('Init node service,node = ', node)
      node.initSrvs()
    }

    // noAllocSrv保存了没有分配节点的服务。
    const noAllocSrv = []
    for (const srvName in that.#srvDef) {
      if (!_.find(that.#nodes, (n) => n.srv(srvName))) {
        noAllocSrv.push(srvName)
      }
    }

    _.forEach(noAllocSrv, (v, k) => {
      SrvFactory.alloc(that, v, that.srvDef(v))
    })

    // 未定义ossDef.
    if (!that.#ossDef) {
      const node = _.find(that.#nodes, (n) => n.srv(SrvFactory.consts.CloudServer))
      if (node) {
        that.#ossDef = {
          type: 'local'
        }
      }
    }
  }

  #procInternal (keyName, keyValue) {
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

  init (definition) {
    // 在init中调用service alloc.
    this.definition = definition
    const that = this
    const { _ } = that.envs.soa

    // console.log('that.definition=', that.definition)

    // 加载cluster的全部服务及节点。
    for (const keyName in that.definition) {
      if (keyName.startsWith('$')) {
        that.#procInternal(keyName, that.definition[keyName])
      } else {
        that.#nodes[keyName] = NodeFactory.create(keyName, that.definition[keyName], that)
      }
      // console.log('nodeName=', keyName)
    }

    // 如果没有任意节点，并且是dev环境，加入默认节点local。
    if (that.envs.args.target === 'dev' && !_.find(that.#nodes, o => o.type === 'local')) {
      that.#nodes.local = NodeFactory.create('local', {
        type: 'local'
      }, that)
    }

    if (_.isEmpty(that.#nodes)) {
      throw new TypeError(`目标集群${that.envs.args.target}未指定任意可计算节点(本地计算机只属于dev集群)。`)
    }

    // console.log(this.nodes)
  }

  async finish () {
  }

  async fetch () {
    // console.log('deployer=', deployer)
    const that = this
    if (that.#feched) {
      return
    }
    const { _, $ } = that.envs.soa
    const tasks = []
    _.forEach(that.#nodes, (v, k) => {
      const task = v.fetch()
      if ($.isPromise(task)) {
        tasks.push(task)
      }
    })
    let animation
    if (tasks.length > 0) {
      const chalkAnimation = (await import('chalk-animation')).default
      const baseStr = '正在获取服务器信息(默认超时20秒)，'
      animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    }
    await Promise.all(tasks)

    if (animation) {
      animation.replace('正在获取服务器的服务状态,请稍候...')
    }
    that.initSrvs()
    tasks.length = 0
    _.forEach(that.#nodes, (v, k) => {
      const task = v.fetchSrv()
      if ($.isPromise(task)) {
        tasks.push(task)
      }
    })
    await Promise.all(tasks)

    if (animation) {
      animation.replace('获取服务器信息及服务状态完成。')
      return new Promise((resolve) => {
        setTimeout(() => {
          animation.stop()
          resolve()
        }, 500)
      })
    }
    // console.log('deployer.nodes=', deployer.nodes.local)
  }
}

module.exports = Cluster
