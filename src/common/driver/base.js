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

// Dev上需要忽略的服务。
const IgDevSrvs = ['webapi', 'webass']

function assignSrv (node, srvName, srv, _) {
  // 本地环境下忽略webapi及webass服务。
  if (node.type === 'local' && IgDevSrvs.indexOf(srvName) >= 0) {
    return
  }
  // 不能将除webass外的服务分配到oss上。
  if (node.type === 'oss' && srvName !== 'webass') {
    return
  }
  // 不能将webass分配到非oss节点上。
  if (node.type !== 'oss' && srvName === 'webass') {
    return
  }
  node.srvs = node.srvs || {}
  node.srvs[srvName] = _.clone(srv)
}

class DriverBase {
  constructor (opts) {
    this.opts = opts
  }

  /**
   * 将一个srv分配给nodes.
   * @param {Nodes} nodes
   * @param {String} srvName
   * @param {Service} srv
   */
  async allocSrv (nodes, srvName, srv) {
    const { _ } = this.opts.soa
    const nodeCount = _.keys(nodes).length
    srv.nodes = srv.nodes || []
    // console.log('srv.nodes=', srv.nodes)
    if (srv.nodes.length === 0) { // 自动分配。
      if (nodeCount <= 5) { // 服务运行于全部节点。
        for (const name in nodes) {
          assignSrv(nodes[name], srvName, srv, _)
        }
      } else {
        // 尚未实现超过5个的服务分配。
        throw new Error('超过5节点的服务自动分配尚未支持。')
      }
    } else {
      for (const name of srv.nodes) {
        assignSrv(nodes[name], srvName, srv, _)
      }
    }
  }

  /**
   * 读取某节点的service状态，结果放入srv对象中。
   * @param {Node} node
   */
  async srvStatus (node) {
    if (node.type === 'local') {
      // 开始获取status。
      const { shelljs, _ } = this.opts.soa
      const dockerPath = shelljs.which('docker')
      for (const srvName in node.srvs) {
        const srv = node.srvs[srvName]
        if (!srv.status) {
          srv.status = { }
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
  }

  /**
   *
   * @param {ComputerNode} node
   */
  async info (node) {
    if (!node.$info) {
      node.$info = {}
      const $info = node.$info
      if (node.type === 'local') { // 本地计算机，使用node来获取而不是命令行。
        const os = require('os')
        $info.cpus = os.cpus()
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
      } else {
        throw new Error('尚未实现获取over ssh get computer information')
      }
    }
    return node.$info
  }
}

module.exports = DriverBase
