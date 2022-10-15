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

const SrvFactory = require('../srv')

/**
 * 如果用户未定义服务如何分配至节点，基类负责维护分配策略。
 */
class Base {
  static SSH = 'ssh'
  static LOCAL = 'local'
  #name
  #cluster
  #nodeDef
  constructor (name, nodeDef, cluster) {
    this.#name = name
    this.#cluster = cluster
    this.#nodeDef = nodeDef
    console.log('nodeDef=', nodeDef)
    this._srvs = {}
  }

  srv (name) {
    return this._srvs[name]
  }

  initSrvs () {
    const that = this
    const { _ } = that.$env.soa
    _.forEach(this.#nodeDef.services, (value) => {
      let def, name
      if (_.isString(value)) {
        def = that.cluster().srvDef(value)
        name = def.name || value
      } else if (_.isObject(value)) {
        def = value
        name = value.name
      }
      if (!_.isObject(def) || !name) {
        throw new Error(`节点${that.#name}中服务无名称或参数${value}`)
      }
      that._srvs[name] = SrvFactory.create(name, def, that)
    })
  }

  get $name () {
    return this.#name
  }

  get $definition () {
    return this.#nodeDef
  }

  get $type () {
    return this.#nodeDef.type === Base.LOCAL ? Base.LOCAL : Base.SSH
  }

  get $cluster () {
    return this.#cluster
  }

  get $env () {
    return this.#cluster.envs
  }

  async finish (node) {
  }
}

module.exports = Base
