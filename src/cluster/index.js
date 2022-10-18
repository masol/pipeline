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

// const CompSrvs = {
//   $webass: 'WebUI编译',
//   $webapi: '服务器编译',
//   $webmb: '手机版编译',
//   $webwx: '小程序编译',
//   $webapp: '应用程序编译',
//   $webtv: 'TV应用编译'
// }

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
    const { _, $ } = that.envs.soa
    const tasks = []
    _.forEach(that.#nodes, async (node, k) => {
      if (node.bSSH) {
        tasks.push(node)
      } else {
        await node.fetch()
      }
    })
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
    _.forEach(that.#nodes, async (node, k) => {
      if (node.bSSH) {
        tasks.push(node)
      } else {
        await node.fetchSrv()
      }
    })
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
    const isDev = that.envs.args.target === 'dev'

    // 首先查找是否需要本地编译webapi。$webass,$webtv等其它服务，通过检查配置项来查看，不属于节点。
    const needComp = {}
    // const { task, series } = opts.gulpInst

    // 以$开头的为需要本地编译的服务。
    const compSrvs = {}
    // 有需要本地部署的服务，在本地编译任务结束后，需要重新调用compNodes的deployApp.
    const compNodes = []

    // 在节点部署就绪后，执行的任务。
    const clusterTasks = []

    // 保存了需要执行任务的节点。
    const tasks = []
    _.forEach(that.#nodes, async (node) => {
      // 本地环境不执行本地编译?
      if (!isDev && node.getCompSrvs(compSrvs)) {
        // 本节点需要本地编译，加入到compNodes.
        compNodes.push(node)
      }
      if (node.bSSH) {
        tasks.push(node)
      } else {
        await node.deployEnv(clusterTasks)
      }
    })

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
      return node.deployEnv(clusterTasks)
    })

    await $.mapLimit(tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv) {
        return taskInfo('afterEnv')
      }
    })

    if (!_.isEmpty(needComp)) {
      if (animation) {
        animation.replace('正在编译本地资源,请稍侯...')
      }
      await that.#compile(needComp)
    }

    await $.mapLimit(tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv) {
        return taskInfo('beforeApp')
      }
    })

    if (animation) {
      animation.replace('正在部署$web相关服务,请稍侯...')
    }
    await $.mapLimit(compNodes, limit, (node) => {
      return node.deployApp(clusterTasks)
    })

    await $.mapLimit(tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv) {
        return taskInfo('afterApp')
      }
    })

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
