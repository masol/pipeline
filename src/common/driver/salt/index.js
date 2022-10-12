/// //////////////////////////////////////////////////////////////////////////
//                                                                          //
//  本文件是WIDE2.0的组成部分.                                                 //
//                                                                          //
//  WIDE website: http://www.prodvest.com/                                  //
//  WIDE website: http://www.pinyan.tech/                                   //
//  License : MIT LICENSE(https://opensource.org/licenses/MIT)              //
/// //////////////////////////////////////////////////////////////////////////
// Created On : 9 Oct 2022 By 李竺唐 of SanPolo.Co.LTD
// File: salt

const Local = require('../local')
const Term = require('./term')

class Salt extends Local {
  async srvStatus (node) {
    if (node.type !== 'ssh') {
      return await super.srvStatus(node)
    }
    throw new Error('sal srvStatus 尚未实现')
  }

  async info (node) {
    if (node.type !== 'ssh') {
      return await super.info(node)
    }
    if (!node.$info) {
      node.$info = {}
      // const $info = node.$info
      const term = await Term.create(this.opts, node)
      // console.log('term=', term)
      // const shell = await term.shell()
      const upTime = await term.exec('uptime')
      console.log('upTime=', upTime)
      await term.close()
    }
  }
}

module.exports = Salt
