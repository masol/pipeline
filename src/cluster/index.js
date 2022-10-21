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
const fse = require('fs-extra')

function taskWrapper (taskHandler) {
  return async function (fullName, srv, taskName) {
    return await taskHandler(srv, taskName)
  }
}

class Cluster {
  #nodes
  #srvDef
  #ossDef
  #feched // 是否已经获取了系统信息。
  #dirty // 是否发生了自动分配，从而需要写回原始的节点定义。
  #localcfg // 写入到localcfg中，在deploy结束时，如果不为空，会将配置写入到config/target/local.json(yml)中。
  constructor (envs) {
    this.envs = envs
    /** 这里加入的任务，在deploy时被清空，然后随着部署，调用其中的成员。其成员的结构如下:
    {
      afterEnv : false,
      beforeApp: false,
      afterApp: false,
      handler: ('stageName')=>{}
    } */
    this.tasks = []
    this.#localcfg = {}
    this.#nodes = {}
    this.#srvDef = {}
    this.#ossDef = null
    this.#dirty = false
    this.#feched = false
  }

  /// 返回localCfg下某个服务的配置项。
  srvCfg (srvName) {
    this.#localcfg[srvName] = this.#localcfg[srvName] || {}
    return this.#localcfg[srvName]
  }

  static #onceTaskCache = {}
  static async callOnceTask (taskName, srvOrNode, taskHandler) {
    // srv为节点或srv实例。其获取名称方式不同。
    const fullName = `${srvOrNode.name || srvOrNode.$name}-${taskName || ''}`
    const { $ } = srvOrNode.node.$env.soa
    if (!Cluster.#onceTaskCache[fullName]) {
      Cluster.#onceTaskCache[fullName] = $.memoize(taskWrapper(taskHandler))
    }
    return await Cluster.#onceTaskCache[fullName](fullName, taskName, srvOrNode)
  }

  get nodes () {
    return this.#nodes
  }

  srvDef (name) {
    return this.#srvDef[name]
  }

  /// @TODO: 未来支持更灵活的条件查询，方便srv来查找关联node.
  /// 寻找配置srvName的节点集合。返回数组，包含了满足条件的节点。
  nodesBySrv (srvName) {
    const ret = []
    for (const nodeName in this.#nodes) {
      const node = this.#nodes[nodeName]
      if (node._srvs[srvName]) {
        ret.push(node)
      }
    }
    return ret
  }

  /// 到Cluster获取完基础信息，获取服务状态前，才调用initSrvs,展开全部服务。因此定义文件中，$service属性位置不关键。并且可以访问节点信息。
  initSrvs () {
    const that = this
    const { _ } = that.envs.soa
    const util = that.envs.config.util
    const ossNode = _.find(that.#nodes, (n) => n.type === 'oss')
    const defSrvs = _.clone(SrvFactory.Base.DefSrvs)
    if (!ossNode) {
      // console.log('未发现ossNode,添加cloudserver服务依赖。')
      defSrvs.push(SrvFactory.Base.CloudServer)
    }

    // 检查服务定义是否已经设置，如未设置，设置为default.
    // 如果服务未启用，但是节点定义中定义了此服务。安全忽略。
    for (let i = 0; i < defSrvs.length; i++) {
      const srvName = defSrvs[i]
      if (!that.#srvDef[srvName] && !util.isDisabled(srvName)) {
        that.#srvDef[srvName] = {}
      }
    }
    for (let i = 0; i < SrvFactory.Base.KnowSrvs.length; i++) {
      const srvName = SrvFactory.Base.KnowSrvs[i]
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
      const node = _.find(that.#nodes, (n) => n.srv(SrvFactory.Base.CloudServer))
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
    const that = this
    const { _, $ } = that.envs.soa

    const limit = parseInt(that.envs.args.concurrency) || 5
    await $.mapLimit(_.values(that.nodes), limit, (node) => {
      return node.finish()
    })
  }

  async fetch () {
    // console.log('deployer=', deployer)
    const that = this
    if (that.#feched) {
      return
    }
    const { $ } = that.envs.soa
    const tasks = []
    for (const nodeName in that.#nodes) {
      const node = that.#nodes[nodeName]
      if (node.bSSH) {
        tasks.push(node)
      } else {
        await node.fetch()
      }
    }
    let animation
    if (tasks.length > 0) {
      const chalkAnimation = (await import('chalk-animation')).default
      const baseStr = '正在获取服务器信息(默认超时20秒)，'
      animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    }

    const limit = parseInt(that.envs.args.concurrency) || 5
    await $.mapLimit(tasks, limit, (node) => {
      return node.fetch()
    })

    if (animation) {
      animation.replace('正在获取服务器的服务状态,请稍候...')
    }
    that.initSrvs()

    tasks.length = 0
    for (const nodeName in that.#nodes) {
      const node = that.#nodes[nodeName]
      if (node.bSSH) {
        tasks.push(node)
      } else {
        await node.fetchSrv()
      }
    }

    await $.mapLimit(tasks, limit, (node) => {
      return node.fetchSrv()
    })

    if (animation) {
      animation.replace('获取服务器信息及服务状态完成。')
      return new Promise((resolve) => {
        setTimeout(() => {
          animation.stop()
          resolve()
        }, 500)
      })
    }
    that.#feched = true
    // console.log('deployer.nodes=', deployer.nodes.local)
  }

  async #compile (taskMaps) {
    if (taskMaps.$webass) {
      // run local assets compile task
    }
    if (taskMaps.$webapi) {
      // run local server compile task
    }
  }

  // 根据cluster的定义，$ossDef,$tvdef等信息来获取本地编译任务。
  #getCompileTask (taskMaps) {
    const that = this
    if (that.#ossDef) {
      taskMaps.$webass = true
    }
    // 添加手机版、pc版、tv版等信息。
    // if (!isDev && that.#ossDef) {
    // }
  }

  async deploy () {
    const that = this
    const { _, $ } = that.envs.soa
    const cfgutil = that.envs.config.util
    const isDev = that.envs.args.target === 'dev'

    const localPath = cfgutil.path('config', that.envs.args.target, 'local.json')

    // 首先查找是否需要本地编译webapi。$webass,$webtv等其它服务，通过检查配置项来查看，不属于节点。
    const needComp = {}
    // const { task, series } = opts.gulpInst

    // 以$开头的为需要本地编译的服务。
    const compSrvs = {}
    // 有需要本地部署的服务，在本地编译任务结束后，需要重新调用compNodes的deployApp.
    const compNodes = []

    // 清空clusterTasks
    that.tasks = []

    // 保存了需要执行任务的节点。
    const tasks = []
    for (const nodeName in that.#nodes) {
      const node = that.#nodes[nodeName]
      // 本地环境不执行本地编译!!
      if (!isDev && node.getCompSrvs(compSrvs)) {
        // 本节点需要本地编译，加入到compNodes.
        compNodes.push(node)
      }
      if (node.bSSH) {
        tasks.push(node)
      } else {
        await node.deployEnv()
      }
    }

    if (!isDev) {
      // 本地环境下不执行编译任务。
      that.#getCompileTask(compSrvs)
    }

    let animation
    if (tasks.length > 0) {
      const chalkAnimation = (await import('chalk-animation')).default
      const baseStr = '正在部署环境(日志保存在每节点的~/install-日期.log中)，'
      animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    }

    const limit = parseInt(that.envs.args.concurrency) || 5
    await $.mapLimit(tasks, limit, (node) => {
      return node.deployEnv()
    })

    await $.mapLimit(that.tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv && _.isFunction(taskInfo.handler)) {
        return taskInfo.handler('afterEnv')
      }
    })

    if (!_.isEmpty(needComp)) {
      if (animation) {
        animation.replace('正在编译本地资源,请稍侯...')
      }
      await that.#compile(needComp)
    }

    await $.mapLimit(that.tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv && _.isFunction(taskInfo.handler)) {
        return taskInfo.handler('beforeApp')
      }
    })

    if (!_.isEmpty(that.#localcfg)) {
      // 将配置写入到target/localcfg中
      await fse.writeJson(localPath, that.#localcfg)
    }

    if (animation) {
      animation.replace('正在部署$web相关服务,请稍侯...')
    }
    await $.mapLimit(compNodes, limit, (node) => {
      return node.deployApp()
    })

    await $.mapLimit(that.tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv && _.isFunction(taskInfo.handler)) {
        return taskInfo.handler('afterApp')
      }
    })

    // 清空clusterTasks
    that.tasks = []

    if (animation) {
      animation.replace('部署完成.')
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          animation.stop()
          resolve()
        }, 500)
      })
    }
  }
}

module.exports = Cluster
