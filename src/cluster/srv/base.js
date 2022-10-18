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

class Base {
  #node
  #name
  constructor (name, srvDef, node) {
    this.srvDef = srvDef || {}
    this.#name = name
    this.#node = node
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
