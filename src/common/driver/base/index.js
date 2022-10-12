/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 12 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: index

// Dev上需要忽略的服务。
const IgDevSrvs = ['$webapi', '$webass', '$webwx', '$webmb', '$webapp', '$webtv']

/**
 * 如果用户未定义服务如何分配至节点，基类负责维护分配策略。
 */
class Base {
  constructor (opts) {
    this.opts = opts
  }

  async finish (node) {
  }

  assignSrv (node, srvName, srv, _) {
    // 本地环境下忽略$webapi及$webass服务。
    if (node.type === 'local' && IgDevSrvs.indexOf(srvName) >= 0) {
      return
    }
    // 不能将除webass外的服务分配到oss上。
    if (node.type === 'oss' && srvName !== '$webass') {
      return
    }
    // 不能将webass分配到非oss节点上。
    if (node.type !== 'oss' && srvName === '$webass') {
      return
    }
    node.srvs = node.srvs || {}
    node.srvs[srvName] = _.clone(srv)
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
          this.assignSrv(nodes[name], srvName, srv, _)
        }
      } else {
        // 尚未实现超过5个的服务分配。
        throw new Error('超过5节点的服务自动分配尚未支持。')
      }
    } else {
      for (const name of srv.nodes) {
        this.assignSrv(nodes[name], srvName, srv, _)
      }
    }
  }
}

module.exports = Base
