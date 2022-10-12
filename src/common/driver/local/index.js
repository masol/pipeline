/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: base

const fs = require('fs').promises
const yaml = require('js-yaml')
const baseUtil = require('./utils')
const OSS = require('../oss')
const ComposeFile = 'docker-compose.yml'

/**
 * local的私有成员，用于构建Docker Compose文件。
 * @param {*} opts
 * @param {*} srvs
 * @param {*} origCompStr
 * @param {*} postTask
 * @returns
 */
async function genCompose (driver, srvs, origCompStr, postTask) {
  const services = []
  const compose = origCompStr
    ? yaml.load(origCompStr, 'utf8')
    : {
        version: '3.9',
        services: {},
        volumes: {},
        networks: {}
      }
  for (const srvName in srvs) {
    const srv = srvs[srvName]
    try {
      const srvFunc = require(`./deploy/${srvName}`).deploy
      // 只有服务未就绪，或者原始compStr无值时才执行。
      if (!srv.ok || !origCompStr) {
        services.push(srvFunc(driver.opts, compose, srvName, srv, postTask))
      } else {
        // console.log('ignore srv:', srvName)
      }
    } catch (e) {
      throw new Error(`请求了未支持的本地服务:${srvName}`)
    }
  }
  await Promise.all(services)
  return yaml.dump(compose, { sortKeys: false })
}

/**
 * 驱动本地获取信息及使用Docker维护服务的Driver。
 */
class Local extends OSS {
  /**
   * 部署一个节点的全部依赖服务。$webXXX除外。
   */
  async deployBase (node, name) {
    if (node.type !== 'local') {
      return super.deployBase(node, name)
    }
    const isForce = this.opts.args.force
    const { shelljs } = this.opts.soa
    const util = this.opts.config.util
    const composePathFile = util.path('config', 'dev', ComposeFile)
    const origCompStr = await fs.readFile(composePathFile, 'utf-8')
      .catch((e) => { return false })
    // 在genCompose调用时，暴露的postTask数组。会在容器启动后执行，例如elastic,用来重置密码，获取证书等动作。
    const postTask = []
    if (!origCompStr || isForce) {
      const content = await genCompose(this, node.srvs, origCompStr, postTask)
      // console.log(content)
      await fs.writeFile(composePathFile, content)
    }
    const compsePath = shelljs.which('docker-compose')
    if (!compsePath) {
      throw new Error('无法获取docker-compose程序路径，因此无法获取本地环境的服务状态。需要安装docker-compose。')
    }
    // const oldPwd = shelljs.pwd()
    // shelljs.cd(devPath)
    const execResult = shelljs.exec(`"${compsePath}" -f "${composePathFile}" up -d`)
    // shelljs.cd(oldPwd)
    if (execResult.code !== 0) {
      throw new Error('docker-compse无法启动本地依赖环境。')
    }
    if (postTask.length > 0) {
      for (const idx in postTask) {
        const task = postTask[idx]
        // console.log('task=', task)
        await task()
      }
    }
  }

  /**
   * 部署一个节点需要编译的服务。$webXXX类服务。本地忽略之。
   * @param {Node} node
   */
  async deployComp (node, name) {
    if (node.type !== 'local') {
      return await super.deployComp(node, name)
    }
  }

  /**
   * 读取某节点的service状态，结果放入srv对象中。
   * @param {Node} node
   */
  async srvStatus (node) {
    if (node.type !== 'local') {
      return await super.srvStatus(node)
    }
    // 开始获取status。
    const { shelljs, _ } = this.opts.soa
    const dockerPath = baseUtil.getDockerBin(shelljs)
    for (const srvName in node.srvs) {
      const srv = node.srvs[srvName]
      if (!srv.status) {
        srv.status = {}
        const execResult = shelljs.exec(`"${dockerPath}" container inspect pv-${srvName}`, { silent: true })
        if (execResult.code === 0) { // 正确发现容器。
          try {
            const info = JSON.parse(execResult.stdout)
            if (_.isArray(info) && info.length === 1) {
              const State = info[0].State
              srv.status.ok = State.Running && !State.Paused && !State.Dead
            }
            if (_.isEmpty(srv.status)) {
              srv.status.ok = false
              srv.status.err = info
            }
          } catch (e) {
            srv.status.ok = false
            srv.status.err = e.message
          }
        } else {
          srv.status.ok = false
          srv.status.err = execResult.stderr
        }
        // console.log(execResult)
      }
    }
  }

  /**
   *
   * @param {ComputerNode} node
   */
  async info (node) {
    if (node.type !== 'local') {
      return await super.info(node)
    }

    if (!node.$info) {
      node.$info = {}
      const $info = node.$info

      const os = require('os')
      const cpus = os.cpus()
      $info.family = cpus.length > 0 ? cpus[0].model : '未知'
      $info.core = cpus.length
      $info.arch = process.arch
      $info.os = {
        platform: os.platform(),
        release: os.release()
      }
      $info.user = os.userInfo()
      $info.mem = {
        total: os.totalmem(),
        free: os.freemem()
      }
      $info.net = {}
      const nets = os.networkInterfaces()
      for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
          // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
          // 'IPv4' is in Node <= 17, from 18 it's a number 4 or 6
          const familyV4Value = typeof net.family === 'string' ? 'IPv4' : 4
          if (net.family === familyV4Value && !net.internal) {
            if (!$info.net[name]) {
              $info.net[name] = []
            }
            $info.net[name].push(net.address)
          }
        }
      }
    }
  }
}

module.exports = Local
