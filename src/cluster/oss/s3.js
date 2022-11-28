/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 25 Nov 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: s3

const Base = require('./base')

class S3 extends Base {
  #inst
  constructor (def, cluster) {
    super(def, cluster)
    const AWS = cluster.envs.AWS
    AWS.config.update(def.conf)
    const s3conf = def.s3conf || {
      apiVersion: '2006-03-01',
      s3ForcePathStyle: true
    }
    this.#inst = new AWS.S3(s3conf)
    console.log('this.#inst=', this.#inst)
  }

  list (prefix) {
  }
}

module.exports = S3
