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
const logger = require('fancy-log')
const path = require('path')
const rlm = require('recursive-last-modified')
const CreateOSS = require('./oss')

function taskWrapper (taskHandler) {
  return async function (fullName, srv, taskName) {
    return await taskHandler(srv, taskName)
  }
}

class Cluster {
  #nodes
  #srvDef
  #ossDef
  #oss // 保存oss对象。
  #cacheBase // 缓冲根目录。api子项目下的.pipeline
  #dns // dns配置服务。如果为空，不设置dns.
  #feched // 是否已经获取了系统信息。
  #target // 额外的编译目标。$webtv/$webmb/$webwx....
  #dirty // 是否发生了自动分配，从而需要写回原始的节点定义。
  #project // pvdev中的project.json的内容。
  #localTime // 本地项目的时间，值为对象。{$webapi,$webass...}
  #compiled // 需要编译的项目。$webapi,$webass
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
    this.#target = {}
    this.#dns = {}
    this.#cacheBase = envs.config.util.path('.pipeline')
    const project = fse.readJsonSync(envs.config.util.path('pvdev', 'project.json'), { throws: false })
    this.#project = project || {}
    this.#localTime = {}
    this.#compiled = {}
  }

  // 是否需要静态部署ass.
  bAssInApi () {
    return this.#compiled.$webass && this.#localTime.$webass && !this.#ossDef
  }

  get oss () {
    if (!this.#oss) {
      if (!this.#ossDef) {
        return null
      }
      const { _ } = this.envs.soa
      const ossDef = {
        conf: _.cloneDeep(this.#ossDef)
      }
      if (ossDef.conf.type) {
        ossDef.type = ossDef.conf.type
        delete ossDef.conf.type
      }
      if (ossDef.conf.bucket) {
        ossDef.bucket = ossDef.conf.bucket
        delete ossDef.conf.bucket
      }
      ossDef.conf.secretAccessKey = this.envs.getVault(ossDef.conf.secretAccessKey)
      this.#oss = CreateOSS(ossDef, this)
    }
    return this.#oss
  }

  get $uiPrjPath () {
    const that = this
    const { shelljs } = that.envs.soa
    const pwd = String(shelljs.pwd())
    const uiPrjPath = that.project.$webass || path.join(path.dirname(pwd), path.basename(pwd) + 'ui')
    return uiPrjPath
  }

  async localTime (item) {
    const that = this
    if (!that.#localTime[item]) {
      const { moment } = that.envs.soa
      switch (item) {
        case '$webapi':
          that.#localTime[item] = moment(rlm(['./src', 'start.js', 'app.js']))
          break
        case '$webass':
          {
            const uiPrjPath = that.$uiPrjPath
            // console.log('urPrjPath=', uiPrjPath)
            if (await fse.pathExists(uiPrjPath)) {
              // UI目录未指定，忽略UI项目的编译及部署。
              that.#localTime[item] = moment(rlm(path.join(uiPrjPath, 'src')))
            }
          }
          break
      }
    }
    return that.#localTime[item]
  }

  get project () {
    return this.#project || {}
  }

  get cacheBase () {
    return this.#cacheBase
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
      // defSrvs.push(SrvFactory.Base.CloudServer)
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
        console.log('found cloundServer:TODO: IMPLEMENT IT!!', node)
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
      case '$dns':
        this.#dns = keyValue
        break
      case '$webwx':
      case '$webmb':
      case '$webtv':
        this.target[keyName] = keyValue
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

  /// 对经过本地编译的服务执行部署动作。
  async #deployCompiled () {
    const that = this
    for (const $srvName in that.#compiled) {
      switch ($srvName) {
        case '$webass':
          if (!that.bAssInApi()) {
            await that.oss.deploy(path.join(that.$uiPrjPath, 'build'))
          }
          break
        default:
          throw new Error(`尚未实现本地服务${$srvName}的部署`)
      }
    }
  }

  // $webwx,$webtv,$webmb需要在cluster.#target中检查。
  async #compile (taskMaps) {
    const that = this
    const { s } = this.envs.soa
    // const apiPwd = String(shelljs.pwd())
    const doCompiler = async (pkgName, cfg) => {
      let compiler
      try {
        compiler = require(`./compiler/${pkgName}`)
      } catch (e) {
        logger.error(`加载编译方式${pkgName}失败:`, e)
      }
      if (compiler) {
        return await compiler(that, cfg)
      }
    }
    for (const compName in taskMaps) {
      const pkgName = s.strRight(compName, '$')
      const cfg = taskMaps[compName]
      await doCompiler(pkgName, cfg)
    }
    for (const compName in this.#target) {
      const cfg = this.#target[compName]
      const pkgName = s.strRight(compName, '$')
      await doCompiler(pkgName, cfg)
    }

    if (taskMaps.$webapi) {
      // console.log('shelljs.pwd()=', apiPwd)
      // run local server compile task
    }
    if (taskMaps.$webass) {
      // run local assets compile task
    }
  }

  // 按照#target.$oss,#target.$webmb以及$dns等配置来部署额外服务。
  async #deployTarget () {
  }

  // 根据cluster的定义，$ossDef,$tvdef等信息来获取本地编译任务。
  async #getCompileTask (taskMaps) {
    const that = this
    const { _, s, moment } = this.envs.soa
    /** webass: 检查oss设置。 */
    // console.log('that.#ossDef=', that.#ossDef)
    const localDate = await that.localTime('$webass')

    if (that.#ossDef) { // 使用oss部署。
      // console.log('使用oss来部署静态资源, implement it!!!!!')
      const serverDateStr = await that.oss.version()
      // console.log('serverDateStr=', serverDateStr)
      if (serverDateStr) {
        const serverDate = moment(serverDateStr)
        if (localDate.isAfter(serverDate)) {
          taskMaps.$webass = true
        }
      } else {
        taskMaps.$webass = true
      }
    } else { // 使用静态部署。
      // console.log('webass localDate=', localDate)
      if (localDate) {
        const nodes = that.nodesBySrv('$webapi')
        // console.log('nodes=', nodes)
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i]
          await n.ensureTerm()
          const serverDateStr = s.trim((await n.$term.exec('cat /srv/webapi/root/version.txt').catch(e => '')))
          if (!serverDateStr) { // 需要编译webass.
            taskMaps.$webass = true
            break
          } else {
            const serverDate = moment(serverDateStr)
            if (localDate.isAfter(serverDate)) {
              taskMaps.$webass = true
              break
            }
          }
          // console.log('lastDate=', lastDate)
        }
      } else {
        logger('UI项目不存在，忽略webass编译与部署。')
      }
    }

    // 添加手机版、pc版、tv版等信息。
    _.assign(taskMaps, that.#target)
  }

  async deploy () {
    const that = this
    const { _, $ } = that.envs.soa
    const cfgutil = that.envs.config.util
    const isDev = that.envs.args.target === 'dev'

    const localPath = cfgutil.path('config', that.envs.args.target, 'local.json')

    // 首先查找是否需要本地编译webapi。$webass,$webtv等其它服务，通过检查配置项来查看，不属于节点。
    // 以$开头的为需要本地编译的服务。
    const needComp = {}
    // const { task, series } = opts.gulpInst

    // 有需要本地部署的服务，在本地编译任务结束后，需要重新调用compNodes的deployApp.
    const compNodes = []

    // 清空clusterTasks
    that.tasks = []

    // 保存了需要执行任务的节点。
    const sshTasks = []
    for (const nodeName in that.#nodes) {
      const node = that.#nodes[nodeName]
      await node.getCompSrvs(needComp)
      // 本地环境不执行本地编译!!
      if (!isDev) {
        // 本节点需要本地编译，加入到compNodes.
        compNodes.push(node)
      }
      if (node.bSSH) {
        sshTasks.push(node)
      } else {
        await node.deployEnv()
      }
    }

    if (!isDev) {
      // 本地环境下不执行编译任务。
      await that.#getCompileTask(needComp)
    }

    let animation
    if (sshTasks.length > 0) {
      const chalkAnimation = (await import('chalk-animation')).default
      const baseStr = '正在部署环境(日志及部署脚本保存在每节点的"~/install-日期"目录中)，'
      animation = chalkAnimation.rainbow(baseStr + '请稍候...')
    }

    const limit = parseInt(that.envs.args.concurrency) || 5
    await $.mapLimit(sshTasks, limit, (node) => {
      return node.deployEnv()
    })

    await $.mapLimit(that.tasks, limit, (taskInfo) => {
      if (taskInfo.afterEnv && _.isFunction(taskInfo.handler)) {
        return taskInfo.handler('afterEnv')
      }
    })

    if (!_.isEmpty(that.#localcfg)) {
      // 将配置写入到target/localcfg中
      await fse.outputJson(localPath, that.#localcfg)
    }
    // 如果default.json存在，则拷贝到对应目录下。
    const defCfg = cfgutil.path('pvdev', 'cluster', that.envs.args.target, 'default.json')
    if (await fse.pathExists(defCfg)) {
      await fse.copy(defCfg, cfgutil.path('config', that.envs.args.target, 'default.json'))
    }

    console.log('needComp=', needComp)
    if (!_.isEmpty(needComp)) {
      if (animation) {
        animation.replace('正在编译本地资源,请稍侯...')
      }
      await that.#compile(needComp)
    }

    that.#compiled = needComp

    await $.mapLimit(that.tasks, limit, (taskInfo) => {
      if (taskInfo.beforeApp && _.isFunction(taskInfo.handler)) {
        return taskInfo.handler('beforeApp')
      }
    })

    if (animation) {
      animation.replace('正在部署$web相关服务,请稍侯...')
    }
    await $.mapLimit(compNodes, limit, (node) => {
      return node.deployApp()
    })
    // @TODO: 检查target的内容，并根据target来部署。
    // that.deployTarget()

    await $.mapLimit(that.tasks, limit, (taskInfo) => {
      if (taskInfo.afterApp && _.isFunction(taskInfo.handler)) {
        return taskInfo.handler('afterApp')
      }
    })

    await that.#deployCompiled()

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
