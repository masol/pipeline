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

const fse = require('fs-extra')
const yaml = require('js-yaml')
const dockerUtil = require('./utils')
const Base = require('../base')
const ComposeFile = 'docker-compose.yml'

/**
 * 驱动本地获取信息及使用Docker维护服务的Driver。
 */
class Local extends Base {
/**
 * local的私有成员，用于构建Docker Compose文件。
 * @param {*} origCompStr
 * @param {*} postTask
 * @returns
 */
  async #genCompose (origCompStr, postTask) {
    const that = this
    const { _ } = that.$env.soa
    const isForce = that.$env.args.force

    const services = []
    const compose = origCompStr
      ? yaml.load(origCompStr, 'utf8')
      : {
          version: '3.9',
          services: {},
          volumes: {},
          networks: {}
        }

    _.forEach(that._srvs, (srv, srvName) => {
      try {
        const srvFunc = require(`./srv/${srvName}`).deploy
        // 只有服务未就绪，或者原始compStr无值时才执行。
        if (isForce || !srv.ok || !origCompStr) {
          services.push(srvFunc(that.$env, compose, srvName, srv, postTask))
        }
      } catch (e) {
        throw new Error(`请求了未支持的本地服务:${srvName}`)
      }
    })
    await Promise.all(services)
    return yaml.dump(compose, { sortKeys: false })
  }

  /**
   * 部署一个节点的全部依赖服务。$webXXX除外。
   */
  async deployEnv () {
    const that = this
    const isForce = that.$env.args.force
    const { shelljs } = that.$env.soa
    const util = that.$env.config.util
    const composePathFile = util.path('config', 'dev', ComposeFile)
    const origCompStr = await fse.readFile(composePathFile, 'utf-8')
      .catch((e) => { return false })
    // 在genCompose调用时，暴露的postTask数组。会在容器启动后执行，例如elastic,用来重置密码，获取证书等动作。
    const postTask = []
    if (!origCompStr || isForce) {
      const content = await that.#genCompose(origCompStr, postTask)
      // console.log(content)
      await fse.outputFile(composePathFile, content)
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
    const nodePath = shelljs.which('node')
    shelljs.exec(`${nodePath} start.js --cmd user`)
    shelljs.exec(`${nodePath} start.js --cmd migrate`)
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
   * 读取本节点的service状态，结果放入srv对象的status中。
   */
  fetchSrv () {
    // 开始获取status。
    const that = this
    const { shelljs, _ } = that.$env.soa
    const dockerPath = dockerUtil.getDockerBin(shelljs)
    _.forEach(that._srvs, (srv, srvName) => {
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
    })
  }

  /**
   *
   */
  fetch () {
    const that = this
    if (!that.info) {
      that.$info = {}
      const $info = that.$info

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
    return that.$info
  }
}

module.exports = Local
