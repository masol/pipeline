/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 15 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: base
const fs = require('fs-extra')

async function ensurePwd (env, pwdFile) {
  let passwd = await fs.readFile(pwdFile, 'utf8').catch(e => {
    return ''
  })

  if (!passwd) {
    const { _ } = env.soa
    passwd = _.cryptoRandom({ length: 16 })
    await fs.ensureFile(pwdFile)
    await fs.writeFile(pwdFile, passwd)
  }
  return passwd
}

/**
 * Download a file to disk
 * @example downloadFile('https://orcascan.com', './barcode-tracking.html')
 * @param {string} fileUrl - url of file to download
 * @param {string} destPath - destination path
 * @returns {Promise} resolves once complete, otherwise rejects
 */
function downloadFile (fileUrl, destPath) {
  if (!fileUrl) return Promise.reject(new Error('Invalid fileUrl'))
  if (!destPath) return Promise.reject(new Error('Invalid destPath'))

  return new Promise(function (resolve, reject) {
    import('node-fetch').then(module => {
      const fetch = module.default
      fetch(fileUrl).then(function (res) {
        const fileStream = fs.createWriteStream(destPath)
        res.body.on('error', reject)
        fileStream.on('finish', resolve)
        res.body.pipe(fileStream)
      })
    })
  })
}

async function ensureZip (fileUrl, target, zipDir) {
  await fs.ensureFile(target)
  await downloadFile(fileUrl, target)

  // console.log('查看日志，多节点，相同url只出现一处,zipDir=', zipDir)
  await fs.emptyDir(zipDir)
  const extractor = (await import('extract-zip')).default
  await extractor(target, { dir: zipDir })
}

class Base {
  #node
  #name
  #masters
  #slaves
  #inited

  static #ensurePwd = null
  static #ensureZip = null

  constructor (name, srvDef, node) {
    this.srvDef = srvDef || {}
    this.#name = name
    this.#node = node
    this.#masters = []
    this.#slaves = []
    this.#inited = false
    if (!Base.#ensurePwd) {
      const envs = node.$env
      const { $, _ } = envs.soa
      Base.#ensurePwd = $.memoize(_.bind(ensurePwd, null, envs))
    }
    if (!Base.#ensureZip) {
      const envs = node.$env
      const { $ } = envs.soa
      Base.#ensureZip = $.memoize(ensureZip)
    }
  }

  /// 确保pwdFile存在，并返回其内容。用于维护基于文件的vault信息。
  /// 相同pwdFile全进程只会执行一次，之后都是返回缓冲。
  static async ensurePwd (pwdFile) {
    if (!Base.#ensurePwd) {
      throw new Error('ensurePwd尚未初始化')
    }
    return await Base.#ensurePwd(pwdFile)
  }

  /// 确保指定fileUrl的zip文件保存在target处(通常为.pipeline/一个子目录)，并正确解压到zipDir处。
  /// 相同url全进程只会执行一次，之后都是返回缓冲。
  static async ensureZip (fileUrl, target, zipDir) {
    if (!Base.#ensureZip) {
      throw new Error('ensureZip尚未初始化')
    }
    return await Base.#ensureZip(fileUrl, target, zipDir)
  }

  #init () {
    const that = this
    if (that.#inited) {
      return
    }
    that.#inited = true
    const srvName = that.name
    const { _ } = that.node.$env.soa
    const srvNodes = that.srvNodes()
    // 先将srv对应的节点加入。
    if (that.srvDef.type === 'slave') {
      that.#slaves.push(that.node)
    } else { // 没有定义或定义为master都意味这master模式。
      that.#masters.push(that.node)
    }

    if (srvNodes.length === 0) { // 单机模式。
      // console.log('配置单机模式pg')
    } else {
      _.forEach(srvNodes, (n) => {
        // console.log('n=', n)
        const otherSrv = n.srv(srvName)
        if (otherSrv.srvDef.type === 'master') {
          this.#masters.push(n)
        } else {
          this.#slaves.push(n)
        }
      })
    }
  }

  async deploy () {
    this.#init()
  }

  #chkCluster () {
    if (!this.#inited) {
      throw new Error('集群信息尚未初始化')
    }
  }

  isSingle () {
    this.#chkCluster()
    return this.#masters.length === 1 && this.#slaves.length === 0
  }

  isMulMaster () {
    this.#chkCluster()
    return this.#masters.length > 1
  }

  #mapIps (nodeArray) {
    const that = this
    const { _ } = that.#node.$cluster.envs.soa
    const ret = []
    _.forEach(nodeArray, (n) => {
      /// @TODO: 如果host是域名,将其解析为ip.
      ret.push(n.$definition.host)
    })
    return ret
  }

  masterIps () {
    this.#chkCluster()
    return this.#mapIps(this.#masters)
  }

  slaveIps () {
    this.#chkCluster()
    return this.#mapIps(this.#slaves)
  }

  // 计算节点上需要忽略的服务。(通过集群的非标部署,例如cluster.$oss来部署$webass)
  static #IgnoreSrvs = ['$webass', '$webwx', '$webmb', '$webapp', '$webtv']
  static #CloudServer = 'cloudserver'
  static #Redis = 'redis'
  static #DefSrvs = ['postgres', 'redis', 'elastic', '$webapi']
  // 可部署的已知服务
  static #KnowSrvs = ['vault', 'keycloak']
  static get IgnoreSrvs () {
    return Base.#IgnoreSrvs
  }

  static get CloudServer () {
    return Base.#CloudServer
  }

  static get Redis () {
    return Base.#Redis
  }

  static get DefSrvs () {
    return Base.#DefSrvs
  }

  static get KnowSrvs () {
    return Base.#KnowSrvs
  }

  get name () {
    return this.#name
  }

  get node () {
    return this.#node
  }

  // 获取集群下，拥有相同服务的节点,不包括自身。
  srvNodes () {
    const that = this
    const allNodes = that.#node.$cluster.nodes
    const { _ } = that.#node.$env.soa
    const ret = []
    _.forEach(allNodes, (node, nodeName) => {
      const srv = node.srv(that.name)
      if (srv && srv !== that) {
        ret.push(node)
      }
    })
    return ret
  }
}

module.exports = Base
