/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Oct 2022 By 李竺唐 of SanPolo.Co.LTD
// File: salt

const Base = require('../base')
const Term = require('./term')
const DepGraph = require('dependency-graph').DepGraph
const path = require('path')
const fse = require('fs-extra')

// 记录不同种类的os,可以使用相同的adapter来维护。
const ostypeMapper = {
  darwin: 'freebsd'
}

// 根据操作系统类加载不同的处理库。
function requireOS (ostype) {
  const type = ostypeMapper[ostype] || ostype
  return require(`./os/${type.toLowerCase()}`)
}

class Commands {
  constructor (sshNode) {
    this.node = sshNode
  }

  // 节点维护函数。需要调用对应的issue来执行。
  async ensurePkg (pkgName, version) {
    const that = this.node
    await requireOS(that.$info.os.type).requireIssue(that).ensurePkg(that, pkgName, version)
  }

  async port (method, number, fromIps) {
    const that = this.node
    await requireOS(that.$info.os.type).requireIssue(that).port(that, method, number, fromIps)
  }

  async startSrv (srvName) {
    const that = this.node
    const srv = that._srvs[srvName]
    if (!srv) {
      throw new Error(that.$name, '节点中未定义服务', srvName, '无法启动之。')
    }
    await requireOS(that.$info.os.type).requireIssue(that).startSrv(srv)
  }
}

class SSH extends Base {
  static DeployEndStr = 'prodvest install script finished.'
  #bash
  #targetDir // 目标目录下的targetDir全路径。
  #assets // 在#bash中引用的额外脚本。会被放入#bash同一目录下，例如被bash调用的expect脚本。
  #depGraph
  #cacheBase // 类似于cluster cacheBase,不过增加了节点名称目录。
  constructor (name, nodeDef, cluster) {
    super(name, nodeDef, cluster)
    // 部署就是创建对应的bash脚本。并在上传至服务器后，执行之。
    // 部分可能断开ssh连接的指令，如port直接使用term.exec在构建期执行完毕。
    // 目前的stage: mirror
    this.#resetBash()
    this.commands = new Commands(this)
    this.#cacheBase = path.join(cluster.cacheBase, name)
  }

  #resetBash () {
    this.#bash = { }
    this.#assets = {}
    this.#depGraph = new DepGraph()
  }

  get instRoot () {
    return this.#targetDir
  }

  async #genBash () {
    const that = this
    const order = that.#depGraph.overallOrder()
    if (order.length === 0 || (order.length === 1 && order[0] === 'mirror')) {
      return ''
    }
    console.log('order=', order)
    console.log('size=', that.#depGraph.size())
    const bashArray = []
    for (const partName of order) {
      const part = that.#bash[partName]
      if (part) { // 防止part不存在，例如添加了依赖，但是依赖不存在。
        bashArray.push(part.join('\n'))
      }
    }
    const preContent = `#/bin/bash
cd ~/install-${new Date().toJSON().slice(0, 10)}
INSTROOT=$(pwd)\n
`
    //
    const postContent = `\necho ${SSH.DeployEndStr}`
    return preContent + bashArray.join('\n') + postContent
  }

  async #runDeploy (localDirPart) {
    const that = this
    const { s } = that.$env.soa
    // 开始生成bash脚本。
    const bashStr = await that.#genBash()
    if (bashStr) { // 有部署脚本需要执行，并上传至服务器。
      const basePath = path.join(that.#cacheBase, localDirPart)
      const scriptName = `${localDirPart}.sh`
      await fse.emptyDir(basePath)
      await fse.writeFile(path.join(basePath, scriptName), bashStr)
      const changeSubFunc = (path.sep === '/' ? null : (pathfile) => { return s.replaceAll(pathfile, '/', path.sep) })
      for (const assetName in that.#assets) {
        const fileName = changeSubFunc ? changeSubFunc(assetName) : assetName
        await fse.writeFile(path.join(basePath, fileName), that.#assets[assetName])
      }
      console.log('bash file=', path.join(basePath, scriptName))
      const sftp = await that.$term.pvftp()
      console.log('basePath=', basePath)
      console.log('that.#targetDir=', that.#targetDir)
      await sftp.cp2Remote(basePath, that.#targetDir)
      if (!that.$env.args['dry-run']) {
        console.log('run deploy for node:', that.$name)
        await that.$term.pvexec(`sudo bash ${that.#targetDir}/${scriptName} 2>&1 | tee -a ${that.logfname}`, {
          out: [{
            mode: 'wait',
            exp: SSH.DeployEndStr,
            action: 'reqExit'
          }],
          opts: {
            debug: true, // 如果debug打开，会在console中打印处理的每行及匹配情况。
            autoExit: false // 自动在cmdline后追加'\nexit'以退出shell，设置为false,需要自行退出。
          }
        })
      }
    }
  }

  hasStage (name) {
    return !!this.#bash[name]
  }

  addAsset (name, cmdStr) {
    this.#assets[name] = cmdStr
  }

  addStage (name, cmdStr, dependencies) {
    const { _ } = this.$env.soa
    this.#bash[name] = this.#bash[name] || []
    if (_.isArray(cmdStr)) {
      this.#bash[name].push(cmdStr.join('\n'))
    } else if (_.isString(cmdStr)) {
      this.#bash[name].push(cmdStr)
    } else {
      throw new Error('调用addStage，但是cmdStr既不是数组也不是字符串！')
    }
    const entryNodes = this.#depGraph.entryNodes()
    // console.log('addStage name=', name)
    // console.log('addStage cmdStr=', cmdStr)
    if (entryNodes.indexOf(name) < 0) {
      this.#depGraph.addNode(name)
    }
    const addDep = (depName) => {
      if (entryNodes.indexOf(depName) < 0) {
        this.#depGraph.addNode(depName)
      }
      this.#depGraph.addDependency(name, depName)
    }
    if (_.isArray(dependencies)) {
      for (let i = 0; i < dependencies.length; i++) {
        addDep(dependencies[i])
      }
    } else if (_.isString(dependencies)) {
      addDep(dependencies)
    }
  }

  stage (name) {
    return this.#bash[name]
  }

  depGraph () {
    return this.#depGraph
  }

  // 节点维护函数。需要调用对应的issue来执行。
  async ensurePkg (pkgName, version) {
    const that = this
    await requireOS(that.$info.os.type).requireIssue(that).ensurePkg(that, pkgName, version)
  }

  async port (method, number, fromIps) {
    const that = this
    await requireOS(that.$info.os.type).requireIssue(that).port(that, method, number, fromIps)
  }

  async startSrv (srvName) {
    const that = this
    const srv = this._srvs[srvName]
    if (!srv) {
      throw new Error(that.$name, '节点中未定义服务', srvName, '无法启动之。')
    }
    await requireOS(that.$info.os.type).requireIssue(that).startSrv(srv)
  }

  async finish () {
    if (this.$term) {
      const term = this.$term
      delete this.$term
      await term.close()
    }
  }

  /// 当前使用结果，stacksalt中的地址大量不可用，支持mirror需要大量改写，而mirror是必须支持的，否则中国区不可用。
  /// 并且mirror需要贯穿软件维护始终，不仅仅是repo.
  /// 因此废弃stacksalt-formula维护方式，直接使用ssh。在mirror开启后，访问大陆区镜像。
  // clusterTasks的值为{'stageName': true,task: handler} 其中stageName为: afterEnv,beforeApp,afterApp
  // clusterTask修改为cluster的成员，自行修改。
  async deployEnv () {
    const that = this
    that.$term = that.$term || await Term.create(that.$envs, that)
    const { s } = that.$env.soa
    const reqMirror = that.$env.args.mirror

    const instDir = `install-${new Date().toJSON().slice(0, 10)}`
    that.#targetDir = s.trim((await that.$term.exec('ls -d ~')), [' ', '\n', '\r'])
    that.#targetDir += ('/' + instDir)

    if (reqMirror) {
      // 检查并修改服务器的mirror设置。
      await requireOS(that.$info.os.type).requireIssue(that).mirror(that)
      // console.log('node=', node)
    }

    const bForce = that.$env.args.force

    // 服务的安装与维护需要串行，防止term上下文依赖。
    for (const srvName in that._srvs) {
      const srv = that._srvs[srvName]
      if (s.startsWith(srvName, '$')) {
        continue
      }
      console.log('srvName=', srvName)
      console.log('srv.ok=', srv)
      // 只有服务未就绪，或者开启了force模式时才执行。
      if (!srv.ok || bForce) {
        await srv.deploy().catch(e => {
          throw new Error(`请求部署服务${srvName}时发生错误:${e}`)
        })
      }
    }
    await that.#runDeploy('depenv')
  }

  async deployApp () {
    const that = this
    that.$term = that.$term || await Term.create(that.$envs, that)
    const { s } = that.$env.soa
    const bForce = that.$env.args.force

    that.#resetBash()
    // 服务的安装与维护需要串行，防止term上下文依赖。
    for (const srvName in that._srvs) {
      const srv = that._srvs[srvName]
      if (!s.startsWith(srvName, '$')) {
        continue
      }
      // 只有服务未就绪，或者开启了force模式时才执行。
      if (!srv.ok || bForce) {
        await srv.deploy().catch(e => {
          throw new Error(`请求部署服务${srvName}时发生错误:${e}`)
        })
      }
    }
    await that.#runDeploy('depapp')
  }

  async fetchSrv () {
    const that = this
    const term = that.$term || await Term.create(this.opts, that)
    that.$term = term
    for (const srvName in that._srvs) {
      const srv = that._srvs[srvName]
      if (!srv.status) {
        srv.status = {}
        await requireOS(that.$info.os.type).fetchSrv(srv)
      }
    }
    // throw new Error('salt srvStatus 尚未实现')
  }

  async fetch () {
    const that = this
    if (!that.$info) {
      const { s } = that.$env.soa
      that.$info = {}
      const $info = that.$info
      const term = that.$term || await Term.create(that.$env, that)
      that.$term = term

      // console.log('term=', term)
      // const shell = await term.shell()
      $info.os = {}
      $info.os.type = s.trim(await term.exec('uname -s'))
      // 如果对应type的fetcher不存在，直接抛出异常。
      await requireOS($info.os.type).fetch(that)
    }
  }
}

module.exports = SSH
