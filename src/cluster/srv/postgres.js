/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License: Apache-2.0 (https://www.apache.org/licenses/LICENSE-2.0)       //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 19 Oct 2022 By 李竺唐 of 北京飞鹿软件技术研究院
// File: postgres
const Base = require('./base')

class Postgres extends Base {
  async deploy (issue, ctx) {
    const that = this
    await super.deploy(issue, ctx)
    console.log('deploy postgresql')
    await that.node.ensurePkg(that.name)
  }
}

module.exports = Postgres