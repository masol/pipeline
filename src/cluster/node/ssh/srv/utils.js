/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 16 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: consts

const path = require('path')
const fs = require('fs-extra')

// 使用salt-formula安装的服务。值为版本文件名。
function getVerFile (srvName) {
  const VerFileMap = {
    postgres: 'VERSION'
  }
  const defVerFile = 'VERSION'
  return VerFileMap[srvName] || defVerFile
}

// cp2Local的过滤函数，对内部服务，只拷贝版本文件，忽略其它。
function saltFilter (remote, entry) {
  const regEx = /^\/srv\/salt\/(.+)\/.*$/
  const result = remote.match(regEx)
  if (result && result.length >= 2) {
    const keepFile = getVerFile(result[1])
    if (!keepFile) { // 不是内部服务，保留全部文件。
      return true
    }
    return keepFile === entry.filename
  }
  return true
}

function addSrv (top, srvName) {
  const srvArray = top.base['*']
  if (srvArray.indexOf(srvName) < 0) {
    srvArray.push(srvName)
  }
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

async function findFormulaRoot (curDir, idFile) {
  const dir = await fs.readdir(curDir).catch(e => [])
  // console.log('dir=', dir)
  if (dir.indexOf(idFile) >= 0) {
    return curDir
  }
  for (let i = 0; i < dir.length; i++) {
    const root = await findFormulaRoot(path.join(curDir, dir[i]), idFile)
    if (root) {
      return root
    }
  }
  return ''
}

// 确保原始素材就绪。相同的fileUrl只会执行一次。由于不清理服务器原有的文件，版本相同，则不再准备其它state file.
async function ensureResource (fileUrl, base, info) {
  const zipFile = path.join(base, `${info.ver}.zip`)
  await fs.ensureFile(zipFile)
  await downloadFile(fileUrl, zipFile)

  const zipDir = path.join(base, info.ver)
  // console.log('查看日志，多节点，相同url只出现一处,zipDir=', zipDir)
  await fs.emptyDir(zipDir)
  const extractor = (await import('extract-zip')).default
  await extractor(zipFile, { dir: zipDir })
  const fomulaBase = await findFormulaRoot(zipDir, info.idFile)
  // console.log('write file to', path.join(fomulaBase, info.subDir, getVerFile(info.name)))
  await fs.writeFile(path.join(fomulaBase, info.subDir, getVerFile(info.name)), info.ver)
  return fomulaBase
}

async function ensurePwdImpl (pwdFile, env) {
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

let ensureResourceCache
let ensurePwdCache
function initCache ($) {
  if (!ensureResourceCache) {
    ensureResourceCache = $.memoize(ensureResource)
  }
  if (!ensurePwdCache) {
    ensurePwdCache = $.memoize(ensurePwdImpl)
  }
}

// 确保本地的stateDir中的state文件就绪。从fomulaRoot/info.subDir中拷贝过来。
async function ensureFormula (fileUrl, base, info, stateDir) {
  const fomulaRoot = await ensureResourceCache(fileUrl, base, info)
  // const zipDir = path.join(base, info.ver)
  // await findFormulaRoot(zipDir, info)
  // console.log('fomulaRoot=', fomulaRoot)
  // console.log('stateDir=', stateDir)
  // console.log('copy src=', path.join(fomulaRoot, info.subDir))
  await fs.emptyDir(stateDir)
  await fs.copy(path.join(fomulaRoot, info.subDir), stateDir, {
    overwrite: true,
    errorOnExist: false
  })
}

/// 尝试从pwdFile中加载密码文件，如果文件不存在，则
async function ensurePasswd (pwdFile, env) {
  return await ensurePwdCache(pwdFile, env)
}

/// 确保stateRes被保存到当前节点下，对应服务下。只有给出强制标志(--force)或版本不符才会拷贝，否则不做任何处理。
async function ensureStateRes (node, info) {
  const { $ } = node.$env.soa
  initCache($)
  const stateDir = path.join(info.localBase, node.$name, 'salt', info.name)
  // console.log('info.name=', info.name, getVerFile(info.name))
  // console.log('path.join(stateDir, fomulaSrvs[info.name])=', path.join(stateDir, getVerFile(info.name)))
  const VerStr = await fs.readFile(path.join(stateDir, getVerFile(info.name)), 'utf8').catch(e => '')

  const isForce = node.$env.args.force
  if (isForce || VerStr !== info.ver) {
    // download file.
    const pipeDir = node.$cluster.cacheBase // node.$env.config.util.path('.pipeline')
    const reqMirror = node.$env.args.mirror
    const url = `${reqMirror ? info.mirror : info.url}${info.ver}.zip`
    const cacheDir = path.join(pipeDir, 'cache', 'salt-formula', info.name)
    await ensureFormula(url, cacheDir, info, stateDir)
    // console.log('pipeDir=', pipeDir)
  }
}

class SrvCluster {
  #masters
  #slaves
  #cluster
  constructor (srv) {
    this.#masters = []
    this.#slaves = []
    this.#cluster = srv.node.$cluster
    this.#init(srv)
  }

  #init (srv) {
    const srvName = srv.name
    const { _ } = srv.node.$env.soa
    const srvNodes = srv.srvNodes()
    // 先将srv对应的节点加入。
    if (srv.srvDef.type === 'master') {
      this.#masters.push(srv.node)
    } else {
      this.#slaves.push(srv.node)
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

  isSingle () {
    return this.#masters.length === 1 && this.#slaves.length === 0
  }

  isMulMaster () {
    return this.#masters.length > 1
  }

  #mapIps (nodeArray) {
    const that = this
    const { _ } = that.#cluster.envs.soa
    const ret = []
    _.forEach(nodeArray, (n) => {
      /// @TODO: 如果host是域名,将其解析为ip.
      ret.push(n.$definition.host)
    })
    return ret
  }

  masterIps () {
    return this.#mapIps(this.#masters)
  }

  slaveIps () {
    return this.#mapIps(this.#slaves)
  }
}

module.exports = {
  saltFilter,
  addSrv,
  ensureStateRes,
  ensurePasswd,
  SrvCluster
}
