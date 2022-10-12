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

const Base = require('../base')

class OSS extends Base {
  async deployBase (node, name) {
    if (node.type !== 'oss') {
      throw new TypeError(`deployBase:请求未支持的节点类型${node.type}`)
    }
  }

  async deployComp (node, name) {
    if (node.type !== 'oss') {
      throw new TypeError(`deployComp:请求未支持的节点类型${node.type}`)
    }
  }

  async srvStatus (node) {
    if (node.type !== 'oss') {
      throw new TypeError(`srvStatus:请求未支持的节点类型${node.type}`)
    }
  }

  async info (node) {
    if (node.type !== 'oss') {
      throw new TypeError(`info:请求未支持的节点类型${node.type}`)
    }
    if (!node.$info) {
      node.$info = {}
      const $info = node.$info
      $info.net = {}
      $info.net.endpoint = []
      $info.net.endpoint.push(node.srvs.cloudserver.endpoint || 'localhost:8000')
    }
  }
}

module.exports = OSS
